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

export interface ProjectInfo {
  path: string;
  valid: boolean;
  hasConfigFile: boolean;
  isNew?: boolean;
}

export interface ProjectInitRequest {
  path: string;
  projectName?: string;
  model?: string;
}

export interface ProjectInitResult {
  success: boolean;
  path: string;
  filesCreated: string[];
  error?: string;
}

export interface HealthResponse {
  status: 'ok';
  timestamp: string;
  uptimeSec: number;
  projectPath: string | null;
  workflowStep: WorkflowStep;
  messageCount: number;
}

export interface DashboardSummary {
  totalCostUsd: number;
  phaseBreakdown: Record<string, { count: number; costUsd: number }>;
}

export type SSEEvent =
  | { type: 'connected' }
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

export type DecisionType = 'prediction' | 'documentation' | 'proposal' | 'review' | 'question';
export type DecisionStatus = 'pending' | 'approved' | 'rejected' | 'modified';

export interface HtmlTab {
  label: string;
  html: string;
}

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
  tabs?: HtmlTab[];
}

export type WorkflowStep =
  | 'idle'
  | 'onboarding'
  | 'prediction'
  | 'documentation'
  | 'development'
  | 'review'
  | 'completed';

export interface WorkflowStateDTO {
  step: WorkflowStep;
  topic: string;
  activeBots: string[];
  decisions: DecisionCardDTO[];
  startedAt: string;
  completedAt?: string;
  epicNumber: number;
  epics: EpicSummary[];
  autoOnboarding: boolean;
}

export interface BotStatusDTO {
  name: string;
  status: 'idle' | 'working' | 'waiting' | 'error' | 'stopped';
  costUsd: number;
  tasksCompleted: number;
  tasksFailed: number;
  currentTask?: string;
  currentTaskIndex?: number;
  totalTasks?: number;
  taskStartedAt?: string;
  lastProgressMessage?: string;
}

// ─── Epic Types ─────────────────────────────────────────────────────────────

export interface EpicSummary {
  epicNumber: number;
  topic: string;
  startedAt: string;
  completedAt: string;
  totalCostUsd: number;
  durationMs: number;
  tasksCompleted: number;
  tasksFailed: number;
  botNames: string[];
  modifiedFiles: string[];
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
