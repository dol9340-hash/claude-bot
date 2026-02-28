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
  | { type: 'heartbeat' };

export type SSEEventType = SSEEvent['type'];
