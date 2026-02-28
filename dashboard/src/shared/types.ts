// Re-export core types from the main ClaudeBot project
// These types define the data structures stored in project files

export type TaskStatus = 'pending' | 'running' | 'completed' | 'failed' | 'skipped';

export type EngineType = 'sdk' | 'cli';

export interface Task {
  line: number;
  rawText: string;
  prompt: string;
  status: TaskStatus;
  cwd?: string;
  maxBudgetUsd?: number;
  maxTurns?: number;
  agent?: string;
  retryCount: number;
  tags: Record<string, string>;
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

export interface ClaudeBotConfig {
  engine: EngineType;
  tasksFile: string;
  cwd: string;
  model?: string;
  permissionMode: 'default' | 'acceptEdits' | 'bypassPermissions';
  maxBudgetPerTaskUsd?: number;
  maxTurnsPerTask?: number;
  maxTotalBudgetUsd?: number;
  taskTimeoutMs: number;
  maxRetries: number;
  stopOnFailure: boolean;
  sessionStorePath: string;
  logLevel: 'debug' | 'info' | 'warn' | 'error';
  allowedTools?: string[];
  systemPromptPrefix?: string;
  watchIntervalMs: number;
  swarm?: SwarmConfig;
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

export interface CostSummary {
  totalCostUsd: number;
  taskCount: number;
  averageCostPerTask: number;
  costByModel: Record<string, number>;
  totalInputTokens: number;
  totalOutputTokens: number;
}
