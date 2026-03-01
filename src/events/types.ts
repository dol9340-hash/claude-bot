import { z } from 'zod';

/**
 * EventBus event payload schemas (Zod-validated).
 * Phase 3.1 — EventBus event types with Zod validation.
 */

export const BotCreatedEventSchema = z.object({
  name: z.string(),
  model: z.string(),
  role: z.string().optional(),
  timestamp: z.string(),
});

export const BotCompletedEventSchema = z.object({
  name: z.string(),
  completed: z.number().int().min(0),
  failed: z.number().int().min(0),
  costUsd: z.number().min(0),
  timestamp: z.string(),
});

export const CostUpdateEventSchema = z.object({
  botName: z.string(),
  taskCostUsd: z.number().min(0),
  totalCostUsd: z.number().min(0),
  budgetPercent: z.number().nullable(),
  timestamp: z.string(),
});

export const ChatMessageEventSchema = z.object({
  id: z.string(),
  from: z.string(),
  to: z.string(),
  content: z.string(),
  channel: z.enum(['main', 'internal']),
  timestamp: z.string(),
  metadata: z.object({
    type: z.enum(['text', 'decision', 'preview', 'proposal', 'report']).optional(),
    options: z.array(z.string()).optional(),
    taskId: z.string().optional(),
  }).optional(),
});

export const ToolUseEventSchema = z.object({
  botName: z.string(),
  toolName: z.string(),
  taskId: z.string().optional(),
  durationMs: z.number().min(0),
  timestamp: z.string(),
});

export const TaskMetricsEventSchema = z.object({
  taskId: z.string(),
  botName: z.string(),
  durationMs: z.number().min(0),
  reworkCount: z.number().int().min(0),
  timestamp: z.string(),
});

export const CostAlertEventSchema = z.object({
  level: z.enum(['warning', 'critical']),
  budgetPercent: z.number(),
  totalCostUsd: z.number().min(0),
  budgetUsd: z.number().positive(),
  timestamp: z.string(),
});

export const DriftDetectedEventSchema = z.object({
  botName: z.string(),
  driftScore: z.number().min(0).max(1),
  reason: z.string(),
  timestamp: z.string(),
});

export const SwarmStartedEventSchema = z.object({
  botCount: z.number().int().positive(),
  timestamp: z.string(),
});

export const SwarmCompletedEventSchema = z.object({
  totalCostUsd: z.number().min(0),
  durationMs: z.number().min(0),
  timestamp: z.string(),
});
