import { z } from 'zod';

// ─── Bot Definition Schema ───────────────────────────────────────────────────

export const BotDefinitionSchema = z.object({
  /** Claude model to use */
  model: z.string().default('claude-sonnet-4-6'),
  /** Inline system prompt (mutually exclusive with systemPromptFile) */
  systemPrompt: z.string().optional(),
  /** Path to system prompt file (relative to project root) */
  systemPromptFile: z.string().optional(),
  /** File globs this bot watches for new tasks */
  watchesFiles: z.array(z.string()).default([]),
  /** Whitelist of bot names this bot can send messages to */
  canContact: z.array(z.string()).default([]),
  /** Bot-specific workspace directory name (under workspacePath) */
  workspaceDir: z.string().optional(),
  /** Max budget per task in USD */
  maxBudgetPerTaskUsd: z.number().positive().optional(),
  /** Max turns per task */
  maxTurnsPerTask: z.number().int().positive().optional(),
  /** If true, this bot posts SWARM_COMPLETE when all watched tasks are done */
  terminatesOnEmpty: z.boolean().default(false),
  /** Allowed tools for this bot */
  allowedTools: z.array(z.string()).optional(),
  /** Execution engine override for this bot */
  engine: z.enum(['sdk', 'cli']).optional(),
  /** Permission mode override for this bot */
  permissionMode: z.enum(['default', 'acceptEdits', 'bypassPermissions']).optional(),
});

export type BotDefinition = z.infer<typeof BotDefinitionSchema>;

// ─── Orchestrator Bot Definition ────────────────────────────────────────────

export const OrchestratorBotDefinitionSchema = BotDefinitionSchema.extend({
  /** Marks this bot as an orchestrator (dynamic bot creator) */
  type: z.literal('orchestrator'),
  /** System prompt template for orchestrator behavior */
  orchestratorPrompt: z.string().optional(),
});

export type OrchestratorBotDefinition = z.infer<typeof OrchestratorBotDefinitionSchema>;

// ─── Message Config Schema ───────────────────────────────────────────────────

export const MessageConfigSchema = z.object({
  /** Routing strategy: explicit = canContact enforced */
  routingStrategy: z.enum(['explicit']).default('explicit'),
  /** Message format */
  format: z.enum(['envelope']).default('envelope'),
  /** Max revision cycles before task is marked failed */
  maxRoutingCycles: z.number().int().positive().default(3),
});

export type MessageConfig = z.infer<typeof MessageConfigSchema>;

// ─── Termination Config Schema ───────────────────────────────────────────────

export const TerminationConfigSchema = z.object({
  /** Grace period in ms after SWARM_COMPLETE before full shutdown */
  gracePeriodMs: z.number().int().min(0).default(30_000),
});

export type TerminationConfig = z.infer<typeof TerminationConfigSchema>;

// ─── SwarmGraph Config Schema ────────────────────────────────────────────────

export const SwarmGraphConfigSchema = z.object({
  /** Shared workspace path (relative to project root) */
  workspacePath: z.string().default('.botspace'),
  /** Board file name */
  boardFile: z.string().default('board.md'),
  /** Registry file name */
  registryFile: z.string().default('registry.json'),
  /** Timeout for stuck tasks in ms */
  stuckTaskTimeoutMs: z.number().int().positive().default(600_000),
  /** Bot names that start the pipeline (others wait for inbox messages) */
  entryBots: z.array(z.string()).min(1),
  /** Bot definitions keyed by name */
  bots: z.record(z.string(), BotDefinitionSchema),
  /** Message configuration */
  message: MessageConfigSchema.default(() => ({
    routingStrategy: 'explicit' as const,
    format: 'envelope' as const,
    maxRoutingCycles: 3,
  })),
  /** Termination configuration */
  termination: TerminationConfigSchema.default(() => ({
    gracePeriodMs: 30_000,
  })),
});

export type SwarmGraphConfig = z.infer<typeof SwarmGraphConfigSchema>;

// ─── Full Swarm Config (top-level claudebot.swarm.json) ──────────────────────

export const SwarmFileConfigSchema = z.object({
  /** Default execution engine */
  engine: z.enum(['sdk', 'cli']).default('sdk'),
  /** Default permission mode */
  permissionMode: z.enum(['default', 'acceptEdits', 'bypassPermissions']).default('acceptEdits'),
  /** Global max budget in USD */
  maxTotalBudgetUsd: z.number().positive().optional(),
  /** Watch interval in ms */
  watchIntervalMs: z.number().int().min(0).default(15_000),
  /** Max concurrent bots (for future Orchestrator phase) */
  maxConcurrentBots: z.number().int().positive().default(5),
  /** Cost alert thresholds (fractions 0-1) */
  costAlertThresholds: z.array(z.number().min(0).max(1)).default([0.7, 0.9]),
  /** The swarm graph configuration */
  swarmGraph: SwarmGraphConfigSchema,
});

export type SwarmFileConfig = z.infer<typeof SwarmFileConfigSchema>;

// ─── Message Envelope ────────────────────────────────────────────────────────

export const BotMessageSchema = z.object({
  /** Unique message ID (auto-increment) */
  id: z.string(),
  /** Sender bot name */
  from: z.string(),
  /** Receiver bot name */
  to: z.string(),
  /** Free-form subject label (domain-defined in prompts, not code) */
  subject: z.string(),
  /** Optional task ID reference */
  taskId: z.string().optional(),
  /** Message body text */
  body: z.string(),
  /** Timestamp */
  timestamp: z.string(),
});

export type BotMessage = z.infer<typeof BotMessageSchema>;

// ─── Registry Entry ──────────────────────────────────────────────────────────

export const TaskStateSchema = z.enum([
  'pending',
  'assigned',
  'in_progress',
  'paused',
  'reviewing',
  'done',
  'failed',
]);

export type TaskState = z.infer<typeof TaskStateSchema>;

export const RegistryEntrySchema = z.object({
  /** Task ID */
  taskId: z.string(),
  /** Current state */
  state: TaskStateSchema,
  /** Bot assigned to this task */
  assignedTo: z.string().optional(),
  /** Source file where the task originated */
  sourceFile: z.string().optional(),
  /** Number of routing/revision cycles */
  routingCycles: z.number().int().min(0).default(0),
  /** Cost accumulated for this task */
  costUsd: z.number().min(0).default(0),
  /** Creation timestamp */
  createdAt: z.string(),
  /** Last update timestamp */
  updatedAt: z.string(),
  /** Human-readable description */
  description: z.string().optional(),
});

export type RegistryEntry = z.infer<typeof RegistryEntrySchema>;

// ─── Registry Store ──────────────────────────────────────────────────────────

export const RegistryStoreSchema = z.object({
  version: z.literal(1),
  tasks: z.record(z.string(), RegistryEntrySchema),
  /** Global message counter for unique IDs */
  messageCounter: z.number().int().min(0).default(0),
});

export type RegistryStore = z.infer<typeof RegistryStoreSchema>;

// ─── Bot Runtime Status ──────────────────────────────────────────────────────

export type BotRuntimeStatus = 'idle' | 'working' | 'waiting' | 'error' | 'stopped';

export interface BotRuntimeInfo {
  name: string;
  status: BotRuntimeStatus;
  currentTaskId?: string;
  costUsd: number;
  tasksCompleted: number;
  tasksFailed: number;
  startedAt: string;
  lastActivityAt: string;
}
