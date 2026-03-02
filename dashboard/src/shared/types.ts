// Simplified types for the Dashboard-only architecture

export interface ClaudeBotConfig {
  model?: string;
  cwd?: string;
  permissionMode?: 'default' | 'acceptEdits' | 'bypassPermissions';
  maxBudgetPerTaskUsd?: number;
  maxTurnsPerTask?: number;
  maxTotalBudgetUsd?: number;
  taskTimeoutMs?: number;
  logLevel?: 'debug' | 'info' | 'warn' | 'error';
  allowedTools?: string[];
  systemPromptPrefix?: string;
  autoOnboarding?: boolean;
  retryOnMaxTurns?: boolean;
  maxTurnsRetryIncrement?: number;
  maxTurnsRetryLimit?: number;
  developmentHeartbeatIntervalMs?: number;
}

export interface SessionRecord {
  sessionId: string;
  prompt: string;
  costUsd: number;
  durationMs: number;
  success: boolean;
  timestamp: string;
  phase: string;
  botName?: string;
  errorCode?: string;
  failureReason?: string;
}

export interface SessionStore {
  version: 1;
  projectCwd: string;
  totalCostUsd: number;
  records: SessionRecord[];
}
