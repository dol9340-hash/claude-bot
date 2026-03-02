/**
 * BotComposer — Creates and manages bot teams for development phases.
 * Connects to SdkExecutor for actual AI execution.
 */
import type { ChatManager } from './chat-manager.js';
import type { IExecutor, ExecuteOptions, ExecutorConfig, TaskResult } from './executor-types.js';
import type { BotStatusDTO } from '../../shared/api-types.js';

// ─── Types ────────────────────────────────────────────────────────────────

export interface BotSpec {
  name: string;
  role: 'developer' | 'reviewer' | 'doc-writer' | 'verifier';
  systemPrompt: string;
  model?: string;
  maxBudgetPerTaskUsd?: number;
  allowedTools?: string[];
  tasks: string[];
}

export interface Bot {
  spec: BotSpec;
  status: BotStatusDTO;
  abortController: AbortController | null;
}

export interface BotTaskResult extends TaskResult {
  botName: string;
  task: string;
}

// ─── BotComposer Class ───────────────────────────────────────────────────

export class BotComposer {
  private executor: IExecutor;
  private chat: ChatManager;
  private bots: Map<string, Bot> = new Map();
  private baseConfig: ExecutorConfig | null = null;
  private totalCostUsd = 0;

  constructor(executor: IExecutor, chat: ChatManager) {
    this.executor = executor;
    this.chat = chat;
  }

  setBaseConfig(config: ExecutorConfig): void {
    this.baseConfig = config;
  }

  getTotalCost(): number {
    return this.totalCostUsd;
  }

  getModifiedFiles(): string[] {
    // Collected from bot execution results
    return [];
  }

  // ─── Bot Team Management ──────────────────────────────────────────────

  createBotTeam(specs: BotSpec[]): Bot[] {
    this.bots.clear();
    const result: Bot[] = [];
    for (const spec of specs) {
      const bot = this.spawnBot(spec);
      result.push(bot);
    }
    this.broadcastBotStatus();
    return result;
  }

  spawnBot(spec: BotSpec): Bot {
    const bot: Bot = {
      spec,
      status: {
        name: spec.name,
        status: 'idle',
        costUsd: 0,
        tasksCompleted: 0,
        tasksFailed: 0,
      },
      abortController: null,
    };
    this.bots.set(spec.name, bot);
    return bot;
  }

  getBot(name: string): Bot | undefined {
    return this.bots.get(name);
  }

  getAllBots(): Bot[] {
    return Array.from(this.bots.values());
  }

  private shouldRetryForMaxTurns(result: TaskResult): boolean {
    if (result.success) return false;
    if (result.result.includes('error_max_turns')) return true;
    return result.errors.some((e) => e.includes('error_max_turns') || e.includes('subtype=error_max_turns'));
  }

  private buildMaxTurnsRetryPrompt(task: string): string {
    const compact = task.replace(/\s+/g, ' ').trim();
    const clipped = compact.length > 420 ? `${compact.slice(0, 420)}...` : compact;
    return [
      '이전 실행이 error_max_turns로 중단되었습니다.',
      '아래 요구사항을 최소 단계로 즉시 구현하세요. 질문/설명 없이 코드 변경을 완료하세요.',
      `요구사항: ${clipped}`,
      '완료 후 변경 파일 목록과 수행한 검증 명령만 간단히 보고하세요.',
    ].join('\n');
  }

  // ─── Bot Execution ────────────────────────────────────────────────────

  async executeBot(bot: Bot, task: string): Promise<BotTaskResult> {
    if (!this.baseConfig) {
      throw new Error('Base config not set. Call setBaseConfig() first.');
    }

    bot.status.status = 'working';
    bot.abortController = new AbortController();
    this.broadcastBotStatus();

    this.chat.addMessage('bot', `[${bot.spec.name}] 작업 시작: ${task.substring(0, 100)}`, {
      botName: bot.spec.name,
      channel: 'internal',
    });

    const config: ExecutorConfig = {
      ...this.baseConfig,
      model: bot.spec.model ?? this.baseConfig.model,
      maxBudgetPerTaskUsd: bot.spec.maxBudgetPerTaskUsd ?? this.baseConfig.maxBudgetPerTaskUsd,
      allowedTools: bot.spec.allowedTools ?? this.baseConfig.allowedTools,
      systemPromptPrefix: bot.spec.systemPrompt,
    };

    const executeAttempt = async (
      prompt: string,
      attemptConfig: ExecutorConfig,
      attemptLabel: 'initial' | 'retry',
    ): Promise<TaskResult> => {
      let reportedCost = 0;

      const options: ExecuteOptions = {
        prompt,
        config: attemptConfig,
        cwd: this.baseConfig!.cwd,
        callbacks: {
          onCost: (costUsd, _sessionId) => {
            const safeCost = Number.isFinite(costUsd) ? Math.max(0, costUsd) : 0;
            const delta = Math.max(0, safeCost - reportedCost);
            reportedCost = Math.max(reportedCost, safeCost);

            if (delta > 0) {
              bot.status.costUsd += delta;
              this.totalCostUsd += delta;
            }

            this.broadcastBotStatus();
          },
          onProgress: (message) => {
            const prefix = attemptLabel === 'retry' ? '(재시도) ' : '';
            this.chat.addMessage('bot', `[${bot.spec.name}] ${prefix}${message}`, {
              botName: bot.spec.name,
              channel: 'internal',
            });
          },
        },
      };

      const result = await this.executor.execute(options);

      // Fallback: if streaming never emitted cost callback, apply final task cost once.
      if (reportedCost === 0 && result.costUsd > 0) {
        bot.status.costUsd += result.costUsd;
        this.totalCostUsd += result.costUsd;
      }

      return result;
    };

    try {
      let result = await executeAttempt(task, config, 'initial');

      const retryEnabled = config.retryOnMaxTurns ?? true;
      if (retryEnabled && this.shouldRetryForMaxTurns(result)) {
        this.chat.addMessage('bot', `[${bot.spec.name}] error_max_turns 감지: 축약 프롬프트로 1회 재시도합니다.`, {
          botName: bot.spec.name,
          channel: 'internal',
        });

        const baseMaxTurns = config.maxTurnsPerTask ?? 24;
        const retryIncrement = Math.max(1, config.maxTurnsRetryIncrement ?? 8);
        const retryLimit = Math.max(baseMaxTurns, config.maxTurnsRetryLimit ?? 48);
        const retryConfig: ExecutorConfig = {
          ...config,
          maxTurnsPerTask: Math.min(baseMaxTurns + retryIncrement, retryLimit),
        };
        const retryPrompt = this.buildMaxTurnsRetryPrompt(task);
        const retryResult = await executeAttempt(retryPrompt, retryConfig, 'retry');

        if (retryResult.success) {
          result = {
            ...retryResult,
            result: `[재시도 성공]\n${retryResult.result}`,
          };
        } else {
          result = {
            ...retryResult,
            errors: [...result.errors, ...retryResult.errors],
          };
        }
      }

      if (result.success) {
        bot.status.tasksCompleted++;
        bot.status.status = 'idle';
      } else {
        bot.status.tasksFailed++;
        bot.status.status = 'error';
      }

      this.broadcastBotStatus();

      const firstError = result.errors?.[0];
      const detail = !result.success && firstError && firstError !== result.result
        ? `\n원인: ${firstError}`
        : '';

      // Post result to internal channel
      this.chat.addMessage('bot', `[${bot.spec.name}] 작업 ${result.success ? '완료' : '실패'}: ${result.result.substring(0, 200)}${detail}`.trim(), {
        botName: bot.spec.name,
        channel: 'internal',
      });

      return { ...result, botName: bot.spec.name, task };
    } catch (error) {
      bot.status.tasksFailed++;
      bot.status.status = 'error';
      this.broadcastBotStatus();

      const errorMsg = error instanceof Error ? error.message : String(error);
      this.chat.addMessage('bot', `[${bot.spec.name}] 오류: ${errorMsg}`, {
        botName: bot.spec.name,
        channel: 'internal',
      });

      return {
        success: false,
        result: errorMsg,
        costUsd: 0,
        durationMs: 0,
        sessionId: '',
        errors: [errorMsg],
        botName: bot.spec.name,
        task,
      };
    } finally {
      bot.abortController = null;
    }
  }

  /**
   * Execute all tasks for a bot sequentially.
   */
  async executeBotTasks(bot: Bot): Promise<BotTaskResult[]> {
    const results: BotTaskResult[] = [];
    for (const task of bot.spec.tasks) {
      const result = await this.executeBot(bot, task);
      results.push(result);
      if (!result.success) break; // Stop on first failure
    }
    bot.status.status = results.every(r => r.success) ? 'idle' : 'error';
    this.broadcastBotStatus();
    return results;
  }

  /**
   * Execute bot teams — developer runs first, then reviewer.
   */
  async executePipeline(bots: Bot[]): Promise<BotTaskResult[]> {
    const allResults: BotTaskResult[] = [];
    const developers = bots.filter(b => b.spec.role === 'developer' || b.spec.role === 'doc-writer');
    const reviewers = bots.filter(b => b.spec.role === 'reviewer' || b.spec.role === 'verifier');

    // Phase 1: Execute developers in parallel
    if (developers.length > 0) {
      const devResults = await Promise.all(
        developers.map(bot => this.executeBotTasks(bot)),
      );
      allResults.push(...devResults.flat());
    }

    // Phase 2: Execute reviewers sequentially (they review dev output)
    for (const reviewer of reviewers) {
      const results = await this.executeBotTasks(reviewer);
      allResults.push(...results);
    }

    return allResults;
  }

  // ─── Abort ──────────────────────────────────────────────────────────

  abortBot(name: string): void {
    const bot = this.bots.get(name);
    if (bot?.abortController) {
      bot.abortController.abort();
      bot.status.status = 'stopped';
      this.broadcastBotStatus();
    }
  }

  abortAll(): void {
    for (const bot of this.bots.values()) {
      if (bot.abortController) {
        bot.abortController.abort();
        bot.status.status = 'stopped';
      }
    }
    this.broadcastBotStatus();
  }

  // ─── Status ─────────────────────────────────────────────────────────

  private broadcastBotStatus(): void {
    const statuses = Array.from(this.bots.values()).map(b => b.status);
    this.chat.broadcastBots(statuses);
  }

  reset(): void {
    this.abortAll();
    this.bots.clear();
    this.totalCostUsd = 0;
  }
}
