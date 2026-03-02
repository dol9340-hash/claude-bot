/**
 * Mock SdkExecutor for tests.
 * Simulates successful/failed bot executions without actual API calls.
 */
import type { IExecutor, ExecuteOptions, TaskResult } from '../../dashboard/src/server/services/executor-types.js';

export interface MockExecutorOptions {
  /** Delay in ms before resolving (default: 10) */
  delayMs?: number;
  /** Whether tasks succeed (default: true) */
  success?: boolean;
  /** Cost per task (default: 0.01) */
  costPerTask?: number;
  /** Custom result text */
  resultText?: string;
  /** Simulate errors on specific call indices (0-based) */
  failOnCalls?: number[];
  /** Custom failure result text */
  failResultText?: string;
  /** Custom failure errors */
  failErrors?: string[];
  /** Optional progress messages emitted on each execute call */
  progressMessages?: string[];
}

export class MockExecutor implements IExecutor {
  private callCount = 0;
  private options: MockExecutorOptions;
  readonly calls: ExecuteOptions[] = [];

  constructor(options: MockExecutorOptions = {}) {
    this.options = {
      delayMs: 10,
      success: true,
      costPerTask: 0.01,
      failResultText: 'Mock task failed',
      failErrors: ['Simulated failure'],
      ...options,
    };
  }

  async execute(options: ExecuteOptions): Promise<TaskResult> {
    this.calls.push(options);
    const idx = this.callCount++;
    const start = Date.now();

    if (this.options.progressMessages && this.options.progressMessages.length > 0) {
      for (const msg of this.options.progressMessages) {
        options.callbacks?.onProgress?.(msg);
      }
    }

    const waitResult = await new Promise<'done' | 'aborted'>((resolve) => {
      const timer = setTimeout(() => {
        cleanup();
        resolve('done');
      }, this.options.delayMs);

      const onAbort = () => {
        clearTimeout(timer);
        cleanup();
        resolve('aborted');
      };

      const signal = options.abortSignal;
      const cleanup = () => signal?.removeEventListener('abort', onAbort);
      if (!signal) return;

      if (signal.aborted) {
        onAbort();
        return;
      }

      signal.addEventListener('abort', onAbort, { once: true });
    });

    if (waitResult === 'aborted') {
      const result: TaskResult = {
        success: false,
        result: 'Task aborted by user',
        costUsd: 0,
        durationMs: Date.now() - start,
        sessionId: `mock-abort-${idx}`,
        errors: ['Task aborted by user'],
      };
      options.callbacks?.onCost?.(0, result.sessionId);
      return result;
    }

    const shouldFail = this.options.failOnCalls?.includes(idx) ?? !this.options.success;

    if (shouldFail) {
      const result: TaskResult = {
        success: false,
        result: this.options.failResultText!,
        costUsd: 0,
        durationMs: Date.now() - start,
        sessionId: `mock-fail-${idx}`,
        errors: [...(this.options.failErrors ?? ['Simulated failure'])],
      };
      options.callbacks?.onCost?.(0, result.sessionId);
      return result;
    }

    const result: TaskResult = {
      success: true,
      result: this.options.resultText ?? `Mock task completed (call #${idx})`,
      costUsd: this.options.costPerTask!,
      durationMs: Date.now() - start,
      sessionId: `mock-${idx}`,
      errors: [],
    };

    options.callbacks?.onCost?.(result.costUsd, result.sessionId);
    return result;
  }

  getCallCount(): number {
    return this.callCount;
  }

  reset(): void {
    this.callCount = 0;
    this.calls.length = 0;
  }
}
