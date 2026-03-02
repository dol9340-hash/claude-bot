import type { TaskResult, ClaudeBotConfig } from '../types.js';

export interface ExecutorCallbacks {
  /** Called when cost is incurred */
  onCost?: (costUsd: number, sessionId: string) => void;
  /** Called for streaming progress */
  onProgress?: (message: string) => void;
}

export interface ExecuteOptions {
  prompt: string;
  config: ClaudeBotConfig;
  cwd?: string;
  abortSignal?: AbortSignal;
  callbacks?: ExecutorCallbacks;
}

/**
 * Executor interface for running AI tasks via Agent SDK.
 */
export interface IExecutor {
  execute(options: ExecuteOptions): Promise<TaskResult>;
}
