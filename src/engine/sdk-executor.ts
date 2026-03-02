import { query } from '@anthropic-ai/claude-agent-sdk';
import type { TaskResult, ClaudeBotConfig } from '../types.js';
import type { IExecutor, ExecuteOptions } from './types.js';
import { createAbortController } from '../utils/abort.js';

interface ErrorWithFields extends Error {
  code?: string | number;
  exitCode?: number;
  signal?: string;
  stdout?: string;
  stderr?: string;
  cause?: unknown;
}

function toErrorMessage(value: unknown): string {
  if (value instanceof Error) return value.message;
  if (typeof value === 'string') return value;
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

function formatSdkFailure(error: unknown): { result: string; errors: string[] } {
  const err = error as ErrorWithFields;
  const base = toErrorMessage(error).trim() || 'Unknown SDK execution error';
  const details: string[] = [base];

  if (err?.code !== undefined) details.push(`code=${String(err.code)}`);
  if (err?.exitCode !== undefined) details.push(`exitCode=${String(err.exitCode)}`);
  if (err?.signal) details.push(`signal=${err.signal}`);

  if (err?.cause) {
    const causeMsg = toErrorMessage(err.cause).trim();
    if (causeMsg && causeMsg !== base) details.push(`cause=${causeMsg}`);
  }

  if (typeof err?.stderr === 'string' && err.stderr.trim().length > 0) {
    details.push(`stderr=${err.stderr.trim().slice(0, 400)}`);
  }

  if (typeof err?.stdout === 'string' && err.stdout.trim().length > 0) {
    details.push(`stdout=${err.stdout.trim().slice(0, 400)}`);
  }

  if (base.includes('process exited with code 1')) {
    details.push('hint=Try permissionMode \"bypassPermissions\" for unattended dashboard runs');
  }

  return {
    result: `Task execution failed: ${base}`,
    errors: details,
  };
}

function pushUnique(errors: string[], value: string): void {
  const v = value.trim();
  if (!v) return;
  if (!errors.includes(v)) errors.push(v);
}

/**
 * SDK Executor — runs prompts via the Claude Agent SDK.
 * Supports optional retry via executeWithRetry().
 */
export class SdkExecutor implements IExecutor {
  private maxRetries = 0;

  setMaxRetries(n: number): void {
    this.maxRetries = n;
  }

  /**
   * Execute with automatic retry on transient errors.
   */
  async executeWithRetry(options: ExecuteOptions): Promise<TaskResult> {
    let lastResult: TaskResult | undefined;

    for (let attempt = 0; attempt <= this.maxRetries; attempt++) {
      const result = await this.execute(options);
      lastResult = result;

      if (result.success) return result;

      const isTransient = result.errors.some(e =>
        e.includes('timeout') || e.includes('ECONNRESET') || e.includes('rate_limit'),
      );
      if (!isTransient || attempt === this.maxRetries) return result;

      const delay = Math.min(1000 * Math.pow(2, attempt), 30000);
      await new Promise(r => setTimeout(r, delay));
    }

    return lastResult!;
  }

  async execute(options: ExecuteOptions): Promise<TaskResult> {
    const { prompt, config, cwd, callbacks, abortSignal } = options;
    const { controller, cleanup } = createAbortController(config.taskTimeoutMs);
    let abortedByUser = false;
    let removeExternalAbortListener = () => {};

    if (abortSignal) {
      const onExternalAbort = () => {
        abortedByUser = true;
        controller.abort();
      };

      if (abortSignal.aborted) {
        onExternalAbort();
      } else {
        abortSignal.addEventListener('abort', onExternalAbort, { once: true });
        removeExternalAbortListener = () => abortSignal.removeEventListener('abort', onExternalAbort);
      }
    }

    const startTime = Date.now();

    let sessionId = '';
    let costUsd = 0;
    let durationMs = 0;
    let resultText = '';
    const errors: string[] = [];
    let lastProgressAt = 0;
    let lastProgressKey = '';

    const emitProgress = (message: string, force = false): void => {
      const text = message.trim();
      if (!text || !callbacks?.onProgress) return;

      const now = Date.now();
      if (!force) {
        if (text === lastProgressKey) return;
        if (now - lastProgressAt < 5000) return;
      }

      lastProgressAt = now;
      lastProgressKey = text;
      callbacks.onProgress(text);
    };

    const sdkOptions: Record<string, unknown> = {
      cwd: cwd ?? config.cwd,
      abortController: controller,
      permissionMode: config.permissionMode,
    };

    if (config.maxTurnsPerTask) sdkOptions.maxTurns = config.maxTurnsPerTask;
    if (config.maxBudgetPerTaskUsd) sdkOptions.maxBudgetUsd = config.maxBudgetPerTaskUsd;
    if (config.model) sdkOptions.model = config.model;
    if (config.permissionMode === 'bypassPermissions') {
      sdkOptions.allowDangerouslySkipPermissions = true;
    }
    if (config.allowedTools) sdkOptions.allowedTools = config.allowedTools;

    const fullPrompt = config.systemPromptPrefix
      ? `${config.systemPromptPrefix}\n\n${prompt}`
      : prompt;

    try {
      const q = query({ prompt: fullPrompt, options: sdkOptions });

      for await (const msg of q) {
        if (msg.type === 'system' && 'subtype' in msg && msg.subtype === 'init') {
          sessionId = (msg as { session_id: string }).session_id;
        }

        if (msg.type === 'system' && 'subtype' in msg) {
          if (msg.subtype === 'task_started' && 'description' in msg && typeof msg.description === 'string') {
            emitProgress(`작업 시작: ${msg.description}`, true);
          } else if (msg.subtype === 'task_progress' && 'description' in msg && typeof msg.description === 'string') {
            emitProgress(`진행: ${msg.description}`);
          } else if (msg.subtype === 'task_notification' && 'status' in msg) {
            const status = String(msg.status);
            const summary = 'summary' in msg && typeof msg.summary === 'string' ? ` - ${msg.summary}` : '';
            emitProgress(`작업 ${status}${summary}`, true);
          } else if (msg.subtype === 'status' && 'status' in msg && msg.status === 'compacting') {
            emitProgress('컨텍스트 압축 중...');
          }
        }

        if (msg.type === 'tool_progress') {
          const toolName = typeof msg.tool_name === 'string' ? msg.tool_name : 'tool';
          emitProgress(`도구 실행 중: ${toolName}`);
        }

        if (msg.type === 'tool_use_summary' && typeof msg.summary === 'string') {
          emitProgress(`도구 요약: ${msg.summary}`, true);
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
            pushUnique(errors, `subtype=${result.subtype}`);
            if (result.errors) {
              for (const e of result.errors) pushUnique(errors, e);
            }
          }
        }
      }
    } catch (error) {
      const isAbortError = error instanceof Error && error.name === 'AbortError';
      if (isAbortError || controller.signal.aborted) {
        if (abortedByUser || abortSignal?.aborted) {
          return {
            success: false,
            result: 'Task aborted by user',
            costUsd,
            durationMs: Date.now() - startTime,
            sessionId,
            errors: ['Task aborted by user'],
          };
        }

        return {
          success: false,
          result: 'Task timed out',
          costUsd,
          durationMs: Date.now() - startTime,
          sessionId,
          errors: ['Task exceeded timeout'],
        };
      }

      const failure = formatSdkFailure(error);
      return {
        success: false,
        result: failure.result,
        costUsd,
        durationMs: Date.now() - startTime,
        sessionId,
        errors: failure.errors,
      };
    } finally {
      removeExternalAbortListener();
      cleanup();
    }

    const success = errors.length === 0 && resultText !== '' && !resultText.startsWith('Task failed');
    callbacks?.onCost?.(costUsd, sessionId);

    return { success, result: resultText, costUsd, durationMs, sessionId, errors };
  }
}
