import type { Task, TaskResult, ClaudeBotConfig } from '../types.js';
import type { Logger } from 'pino';

export interface ExecutorCallbacks {
  /** Called when cost is incurred */
  onCost?: (costUsd: number, sessionId: string) => void;
  /** Called for streaming progress */
  onProgress?: (message: string) => void;
}

/**
 * Abstract executor interface shared by SDK and CLI engines.
 * Both engines must implement this contract.
 */
export interface IExecutor {
  readonly engineType: 'sdk' | 'cli';

  execute(
    task: Task,
    config: ClaudeBotConfig,
    logger: Logger,
    callbacks?: ExecutorCallbacks,
  ): Promise<TaskResult>;
}
