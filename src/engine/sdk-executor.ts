import { query } from '@anthropic-ai/claude-agent-sdk';
import type { Logger } from 'pino';
import type { Task, TaskResult, ClaudeBotConfig } from '../types.js';
import type { IExecutor, ExecutorCallbacks } from './types.js';
import { createAbortController } from '../utils/abort.js';

/**
 * SDK Executor - Primary engine using the Claude Agent SDK.
 * Requires an Anthropic API Key for billing.
 * Provides exact cost tracking, typed messages, and native subagent support.
 */
export class SdkExecutor implements IExecutor {
  readonly engineType = 'sdk' as const;

  async execute(
    task: Task,
    config: ClaudeBotConfig,
    logger: Logger,
    callbacks?: ExecutorCallbacks,
  ): Promise<TaskResult> {
    const { controller, cleanup } = createAbortController(config.taskTimeoutMs);
    const startTime = Date.now();

    let sessionId = '';
    let costUsd = 0;
    let durationMs = 0;
    let resultText = '';
    const errors: string[] = [];

    const sdkOptions: Record<string, unknown> = {
      cwd: task.cwd ?? config.cwd,
      abortController: controller,
      permissionMode: config.permissionMode,
    };

    if (task.maxTurns ?? config.maxTurnsPerTask) {
      sdkOptions.maxTurns = task.maxTurns ?? config.maxTurnsPerTask;
    }
    if (task.maxBudgetUsd ?? config.maxBudgetPerTaskUsd) {
      sdkOptions.maxBudgetUsd = task.maxBudgetUsd ?? config.maxBudgetPerTaskUsd;
    }
    if (config.model) {
      sdkOptions.model = config.model;
    }
    if (config.permissionMode === 'bypassPermissions') {
      sdkOptions.allowDangerouslySkipPermissions = true;
    }
    if (config.allowedTools) {
      sdkOptions.allowedTools = config.allowedTools;
    }

    // Inject swarm agents if configured
    if (config.swarm?.enabled && config.swarm.agents) {
      sdkOptions.agents = config.swarm.agents;
      const tools = (sdkOptions.allowedTools as string[] | undefined) ?? [];
      if (!tools.includes('Task')) {
        sdkOptions.allowedTools = [...tools, 'Task'];
      }
      if (config.swarm.mainAgent) {
        sdkOptions.agent = config.swarm.mainAgent;
      }
    }

    const fullPrompt = config.systemPromptPrefix
      ? `${config.systemPromptPrefix}\n\n${task.prompt}`
      : task.prompt;

    logger.info({ taskLine: task.line, prompt: task.prompt }, 'Executing task via SDK engine');

    try {
      const q = query({ prompt: fullPrompt, options: sdkOptions });

      for await (const msg of q) {
        if (msg.type === 'system' && 'subtype' in msg && msg.subtype === 'init') {
          sessionId = (msg as { session_id: string }).session_id;
          logger.debug({ sessionId }, 'Session initialized');
        }

        if (msg.type === 'result') {
          const result = msg as {
            subtype: string;
            total_cost_usd: number;
            duration_ms: number;
            session_id: string;
            result?: string;
            errors?: string[];
          };
          costUsd = result.total_cost_usd;
          durationMs = result.duration_ms;
          sessionId = result.session_id;

          if (result.subtype === 'success') {
            resultText = result.result ?? '';
          } else {
            resultText = `Task failed: ${result.subtype}`;
            if (result.errors) {
              errors.push(...result.errors);
            }
          }
        }
      }
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        logger.warn({ taskLine: task.line }, 'Task timed out');
        return {
          task,
          success: false,
          result: 'Task timed out',
          costUsd,
          durationMs: Date.now() - startTime,
          sessionId,
          errors: ['Task exceeded timeout'],
        };
      }
      throw error;
    } finally {
      cleanup();
    }

    const success = errors.length === 0 && resultText !== '' && !resultText.startsWith('Task failed');
    callbacks?.onCost?.(costUsd, sessionId);

    return {
      task,
      success,
      result: resultText,
      costUsd,
      durationMs,
      sessionId,
      errors,
    };
  }
}
