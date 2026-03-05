/**
 * Local type definitions for the executor interface.
 * Mirrors src/engine/types.ts to avoid rootDir boundary violations.
 */

export interface TaskResult {
  success: boolean;
  result: string;
  costUsd: number;
  durationMs: number;
  sessionId: string;
  errors: string[];
}

export interface ExecutorCallbacks {
  onCost?: (costUsd: number, sessionId: string) => void;
  onProgress?: (message: string) => void;
}

export interface ExecuteOptions {
  prompt: string;
  config: ExecutorConfig;
  cwd?: string;
  abortSignal?: AbortSignal;
  callbacks?: ExecutorCallbacks;
  resumeSessionId?: string;
}

export interface ExecutorConfig {
  model?: string;
  cwd: string;
  permissionMode: 'default' | 'acceptEdits' | 'bypassPermissions';
  maxBudgetPerTaskUsd?: number;
  maxTurnsPerTask?: number;
  maxTotalBudgetUsd?: number;
  taskTimeoutMs: number;
  logLevel: 'debug' | 'info' | 'warn' | 'error';
  allowedTools?: string[];
  systemPromptPrefix?: string;
  autoOnboarding?: boolean;
  retryOnMaxTurns?: boolean;
  maxTurnsRetryIncrement?: number;
  maxTurnsRetryLimit?: number;
  developmentHeartbeatIntervalMs?: number;
}

export interface IExecutor {
  execute(options: ExecuteOptions): Promise<TaskResult>;
}
