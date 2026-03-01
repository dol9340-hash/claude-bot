import { z } from 'zod';

// ─── Bot Proposal (Step 3: Sub-Bot proposal & approval) ─────────────────────

export const BotProposalSchema = z.object({
  name: z.string(),
  role: z.string(),
  model: z.enum(['sonnet', 'opus', 'haiku']).default('sonnet'),
  allowedTools: z.array(z.string()),
  canContact: z.array(z.string()),
  maxBudgetPerTaskUsd: z.number().positive(),
  justification: z.string(),
});

export type BotProposal = z.infer<typeof BotProposalSchema>;

// ─── Output Preview (Step 2: Preview report) ────────────────────────────────

export interface OutputPreview {
  topic: string;
  fileStructure: Array<{ path: string; action: 'create' | 'modify' }>;
  features: string[];
  estimatedCost: { min: number; max: number };
  estimatedTurns: { min: number; max: number };
  techDecisions: string[];
  testPlan: string[];
  dependencies: Array<{ name: string; action: 'add' | 'update' | 'remove' }>;
}

// ─── Onboarding Documents (Step 1) ──────────────────────────────────────────

export interface OnboardingResult {
  topic: string;
  prdContent: string;
  techSpecContent: string;
  taskContent: string;
  pocRequired: boolean;
  pocResults?: string;
}

// ─── Decision Card ──────────────────────────────────────────────────────────

export type DecisionType = 'preview' | 'proposal' | 'approval' | 'question';
export type DecisionStatus = 'pending' | 'approved' | 'rejected' | 'modified';

export interface DecisionCard {
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

// ─── Workflow State ─────────────────────────────────────────────────────────

export type WorkflowStep = 'idle' | 'onboarding' | 'preview' | 'proposal' | 'execution' | 'completed';

export interface WorkflowState {
  step: WorkflowStep;
  topic: string;
  onboarding?: OnboardingResult;
  preview?: OutputPreview;
  proposals?: BotProposal[];
  activeBots: string[];
  decisions: DecisionCard[];
  startedAt: string;
  completedAt?: string;
}

// ─── Chat Message ───────────────────────────────────────────────────────────

export type ChatRole = 'user' | 'orchestrator' | 'system' | 'bot';

export interface ChatMessage {
  id: string;
  role: ChatRole;
  botName?: string;
  content: string;
  channel: 'main' | 'internal';
  timestamp: string;
  decision?: DecisionCard;
}

// ─── Chat Store (persisted to disk) ─────────────────────────────────────────

export interface ChatStore {
  version: 1;
  workflow: WorkflowState;
  messages: ChatMessage[];
}
