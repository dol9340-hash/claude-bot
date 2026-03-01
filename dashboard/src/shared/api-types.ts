import type { SessionRecord } from './types.js';

export interface ProjectInfo {
  path: string;
  valid: boolean;
  hasSessionsFile: boolean;
  hasConfigFile: boolean;
  hasTasksFile: boolean;
  tasksFilePath: string;
}

export interface DashboardSummary {
  totalTasks: number;
  completedTasks: number;
  failedTasks: number;
  pendingTasks: number;
  totalCostUsd: number;
  averageCostPerTask: number;
  averageDurationMs: number;
  totalDurationMs: number;
  engineBreakdown: {
    sdk: { count: number; costUsd: number };
    cli: { count: number; costUsd: number };
  };
  budgetUsagePercent: number | null;
  recentSessions: SessionRecord[];
}

export type SSEEvent =
  | { type: 'connected' }
  | { type: 'sessions_updated' }
  | { type: 'tasks_updated' }
  | { type: 'config_updated' }
  | { type: 'heartbeat' }
  | { type: 'chat_message' }
  | { type: 'decision_update' }
  | { type: 'workflow_update' };

export type SSEEventType = SSEEvent['type'];

// ─── Chat Types ─────────────────────────────────────────────────────────────

export type ChatRole = 'user' | 'orchestrator' | 'system' | 'bot';

export interface ChatMessageDTO {
  id: string;
  role: ChatRole;
  botName?: string;
  content: string;
  channel: 'main' | 'internal';
  timestamp: string;
  decision?: DecisionCardDTO;
}

export type DecisionType = 'preview' | 'proposal' | 'approval' | 'question';
export type DecisionStatus = 'pending' | 'approved' | 'rejected' | 'modified';

export interface DecisionCardDTO {
  id: string;
  type: DecisionType;
  title: string;
  description: string;
  options: string[];
  status: DecisionStatus;
  response?: string;
  createdAt: string;
  resolvedAt?: string;
}

export type WorkflowStep = 'idle' | 'onboarding' | 'preview' | 'proposal' | 'execution' | 'completed';

export interface WorkflowStateDTO {
  step: WorkflowStep;
  topic: string;
  activeBots: string[];
  decisions: DecisionCardDTO[];
  startedAt: string;
  completedAt?: string;
}

export interface BotStatusDTO {
  name: string;
  status: 'idle' | 'working' | 'waiting' | 'error' | 'stopped';
  costUsd: number;
  tasksCompleted: number;
  tasksFailed: number;
}

// ─── WebSocket Messages ─────────────────────────────────────────────────────

export type WSClientMessage =
  | { type: 'chat'; content: string }
  | { type: 'decision'; decisionId: string; status: 'approved' | 'rejected' | 'modified'; response?: string };

export type WSServerMessage =
  | { type: 'chat'; message: ChatMessageDTO }
  | { type: 'workflow'; state: WorkflowStateDTO }
  | { type: 'bots'; bots: BotStatusDTO[] }
  | { type: 'decision'; card: DecisionCardDTO }
  | { type: 'error'; message: string };
