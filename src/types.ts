export type TaskStatus = 'pending' | 'running' | 'completed' | 'failed' | 'skipped';

export type EngineType = 'sdk' | 'cli';

export interface Task {
  /** Line number in tasks.md (1-indexed) for write-back */
  line: number;
  /** Original raw text from the markdown checkbox */
  rawText: string;
  /** Cleaned prompt text sent to the agent */
  prompt: string;
  /** Current execution status */
  status: TaskStatus;
  /** Optional working directory override */
  cwd?: string;
  /** Optional max budget for this task (USD) */
  maxBudgetUsd?: number;
  /** Optional max turns */
  maxTurns?: number;
  /** Optional agent name (for swarm mode) */
  agent?: string;
  /** Number of retry attempts so far */
  retryCount: number;
  /** Tags extracted from task text, e.g. [cwd:/some/path] */
  tags: Record<string, string>;
}

export interface TaskResult {
  task: Task;
  success: boolean;
  /** Text result or error description */
  result: string;
  /** Cost in USD (SDK: exact, CLI: estimated or -1 if unavailable) */
  costUsd: number;
  /** Duration in milliseconds */
  durationMs: number;
  /** Session ID for potential resume */
  sessionId: string;
  /** Errors encountered */
  errors: string[];
}

export interface SessionRecord {
  taskLine: number;
  taskPrompt: string;
  sessionId: string;
  costUsd: number;
  durationMs: number;
  status: TaskStatus;
  timestamp: string;
  retryCount: number;
  engine: EngineType;
}

export interface SessionStore {
  version: 1;
  projectCwd: string;
  totalCostUsd: number;
  records: SessionRecord[];
}

export interface CostSummary {
  totalCostUsd: number;
  taskCount: number;
  averageCostPerTask: number;
  costByModel: Record<string, number>;
  totalInputTokens: number;
  totalOutputTokens: number;
}

export interface SwarmConfig {
  enabled: boolean;
  agents: Record<string, {
    description: string;
    prompt: string;
    tools?: string[];
    model?: 'sonnet' | 'opus' | 'haiku' | 'inherit';
    maxTurns?: number;
  }>;
  mainAgent?: string;
}

export interface ClaudeBotConfig {
  /** Execution engine: 'sdk' (API Key) or 'cli' (Max subscription) */
  engine: EngineType;
  /** Path to the tasks markdown file */
  tasksFile: string;
  /** Default working directory */
  cwd: string;
  /** Claude model to use */
  model?: string;
  /** Permission mode */
  permissionMode: 'default' | 'acceptEdits' | 'bypassPermissions';
  /** Required when permissionMode is 'bypassPermissions' */
  allowDangerouslySkipPermissions?: boolean;
  /** Max budget per task (USD) */
  maxBudgetPerTaskUsd?: number;
  /** Max turns per task */
  maxTurnsPerTask?: number;
  /** Global max budget for entire run (USD) */
  maxTotalBudgetUsd?: number;
  /** Task timeout in milliseconds */
  taskTimeoutMs: number;
  /** Max retry attempts per task */
  maxRetries: number;
  /** Stop entire queue on first failure */
  stopOnFailure: boolean;
  /** Path to session store file */
  sessionStorePath: string;
  /** Log level */
  logLevel: 'debug' | 'info' | 'warn' | 'error';
  /** Tools the agent is allowed to use */
  allowedTools?: string[];
  /** Additional system prompt prefix */
  systemPromptPrefix?: string;
  /** Watch mode: poll interval in ms when queue is empty (0 = disabled) */
  watchIntervalMs: number;
  /** Multi-agent swarm configuration */
  swarm?: SwarmConfig;
}
