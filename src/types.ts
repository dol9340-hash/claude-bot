export type EngineType = 'sdk';

export interface TaskResult {
  success: boolean;
  /** Text result or error description */
  result: string;
  /** Cost in USD */
  costUsd: number;
  /** Duration in milliseconds */
  durationMs: number;
  /** Session ID for tracking */
  sessionId: string;
  /** Errors encountered */
  errors: string[];
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

export interface ClaudeBotConfig {
  /** Claude model to use */
  model?: string;
  /** Default working directory */
  cwd: string;
  /** Permission mode */
  permissionMode: 'default' | 'acceptEdits' | 'bypassPermissions';
  /** Max budget per bot task (USD) */
  maxBudgetPerTaskUsd?: number;
  /** Max turns per bot task */
  maxTurnsPerTask?: number;
  /** Global max budget (USD) */
  maxTotalBudgetUsd?: number;
  /** Task timeout in milliseconds */
  taskTimeoutMs: number;
  /** Log level */
  logLevel: 'debug' | 'info' | 'warn' | 'error';
  /** Tools the agent is allowed to use */
  allowedTools?: string[];
  /** Additional system prompt prefix */
  systemPromptPrefix?: string;
  /** Auto-Pilot mode — auto-start next Epic after completion */
  autoOnboarding?: boolean;
  /** Retry once when SDK returns error_max_turns */
  retryOnMaxTurns?: boolean;
  /** Extra max turns to grant on retry */
  maxTurnsRetryIncrement?: number;
  /** Upper bound for max turns during retry */
  maxTurnsRetryLimit?: number;
  /** Main-channel heartbeat interval while developing (ms) */
  developmentHeartbeatIntervalMs?: number;
}
