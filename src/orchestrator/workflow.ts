import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import type { Logger } from 'pino';
import type {
  ChatStore,
  ChatMessage,
  WorkflowState,
  WorkflowStep,
  DecisionCard,
  DecisionType,
  OutputPreview,
  BotProposal,
  OnboardingResult,
} from './types.js';
import { getEventBus } from '../events/index.js';

/**
 * WorkflowManager — manages the 4-Step Workflow state and chat history.
 * Persists state to `.claudebot/chat.json` in the project directory.
 */
export class WorkflowManager {
  private store: ChatStore;
  private storePath: string;
  private logger: Logger;

  constructor(projectRoot: string, logger: Logger) {
    this.logger = logger;
    this.storePath = path.join(projectRoot, '.claudebot', 'chat.json');
    this.store = this.load();
  }

  private load(): ChatStore {
    try {
      if (fs.existsSync(this.storePath)) {
        return JSON.parse(fs.readFileSync(this.storePath, 'utf-8'));
      }
    } catch {
      this.logger.warn('Failed to load chat store, starting fresh');
    }
    return this.createEmptyStore();
  }

  private createEmptyStore(): ChatStore {
    return {
      version: 1,
      workflow: {
        step: 'idle',
        topic: '',
        activeBots: [],
        decisions: [],
        startedAt: new Date().toISOString(),
      },
      messages: [],
    };
  }

  private save(): void {
    const dir = path.dirname(this.storePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(this.storePath, JSON.stringify(this.store, null, 2), 'utf-8');
  }

  private genId(): string {
    return crypto.randomUUID().slice(0, 8);
  }

  // ─── Chat Messages ─────────────────────────────────────────────────────

  addMessage(
    role: ChatMessage['role'],
    content: string,
    opts?: { botName?: string; channel?: 'main' | 'internal'; decision?: DecisionCard },
  ): ChatMessage {
    const msg: ChatMessage = {
      id: this.genId(),
      role,
      botName: opts?.botName,
      content,
      channel: opts?.channel ?? 'main',
      timestamp: new Date().toISOString(),
      decision: opts?.decision,
    };

    this.store.messages.push(msg);
    this.save();

    getEventBus().emit('chat:message', {
      id: msg.id,
      from: msg.botName ?? msg.role,
      to: msg.channel === 'main' ? 'user' : 'internal',
      content: msg.content,
      channel: msg.channel,
      timestamp: msg.timestamp,
      metadata: msg.decision ? { type: 'decision', options: msg.decision.options } : undefined,
    });

    return msg;
  }

  getMessages(channel?: 'main' | 'internal'): ChatMessage[] {
    if (channel) {
      return this.store.messages.filter((m) => m.channel === channel);
    }
    return this.store.messages;
  }

  getRecentMessages(limit = 50): ChatMessage[] {
    return this.store.messages.slice(-limit);
  }

  // ─── Workflow State ─────────────────────────────────────────────────────

  getWorkflow(): WorkflowState {
    return this.store.workflow;
  }

  setStep(step: WorkflowStep): void {
    this.store.workflow.step = step;
    this.save();
    this.addMessage('system', `Workflow step changed to: ${step}`);
  }

  // ─── Step 1: Onboarding ─────────────────────────────────────────────────

  startOnboarding(topic: string): void {
    this.store.workflow.topic = topic;
    this.store.workflow.step = 'onboarding';
    this.store.workflow.startedAt = new Date().toISOString();
    this.save();
  }

  completeOnboarding(result: OnboardingResult): void {
    this.store.workflow.onboarding = result;
    this.store.workflow.step = 'preview';
    this.save();
  }

  // ─── Step 2: Output Preview ─────────────────────────────────────────────

  setPreview(preview: OutputPreview): DecisionCard {
    this.store.workflow.preview = preview;
    const card = this.createDecision('preview', 'Output Preview', this.formatPreview(preview));
    this.save();
    return card;
  }

  private formatPreview(preview: OutputPreview): string {
    const lines: string[] = [
      `Topic: ${preview.topic}`,
      '',
      'Files:',
      ...preview.fileStructure.map((f) => `  ${f.action === 'create' ? '(new)' : '(mod)'} ${f.path}`),
      '',
      'Features:',
      ...preview.features.map((f) => `  - ${f}`),
      '',
      `Cost: $${preview.estimatedCost.min.toFixed(2)} ~ $${preview.estimatedCost.max.toFixed(2)}`,
      `Turns: ${preview.estimatedTurns.min} ~ ${preview.estimatedTurns.max}`,
      '',
      'Tech Decisions:',
      ...preview.techDecisions.map((d) => `  - ${d}`),
      '',
      'Test Plan:',
      ...preview.testPlan.map((t) => `  - ${t}`),
    ];
    return lines.join('\n');
  }

  // ─── Step 3: Bot Proposal ──────────────────────────────────────────────

  setProposals(proposals: BotProposal[]): DecisionCard {
    this.store.workflow.proposals = proposals;
    this.store.workflow.step = 'proposal';

    const desc = proposals
      .map((p, i) => `${i + 1}. ${p.name} (${p.model}) - ${p.role}\n   Budget: $${p.maxBudgetPerTaskUsd}\n   Reason: ${p.justification}`)
      .join('\n\n');

    const card = this.createDecision('proposal', 'Bot Team Proposal', desc);
    this.save();
    return card;
  }

  // ─── Step 4: Execution ─────────────────────────────────────────────────

  startExecution(botNames: string[]): void {
    this.store.workflow.step = 'execution';
    this.store.workflow.activeBots = botNames;
    this.save();
  }

  completeExecution(): void {
    this.store.workflow.step = 'completed';
    this.store.workflow.completedAt = new Date().toISOString();
    this.save();
  }

  // ─── Decision Cards ────────────────────────────────────────────────────

  createDecision(type: DecisionType, title: string, description: string, options?: string[]): DecisionCard {
    const card: DecisionCard = {
      id: this.genId(),
      type,
      title,
      description,
      options: options ?? ['Approve', 'Modify', 'Reject'],
      status: 'pending',
      createdAt: new Date().toISOString(),
    };

    this.store.workflow.decisions.push(card);
    this.save();

    this.addMessage('orchestrator', description, { decision: card });

    return card;
  }

  resolveDecision(decisionId: string, status: 'approved' | 'rejected' | 'modified', response?: string): DecisionCard | null {
    const card = this.store.workflow.decisions.find((d) => d.id === decisionId);
    if (!card || card.status !== 'pending') return null;

    card.status = status;
    card.response = response;
    card.resolvedAt = new Date().toISOString();
    this.save();

    this.addMessage('user', `Decision "${card.title}": ${status}${response ? ` — ${response}` : ''}`);

    return card;
  }

  getPendingDecisions(): DecisionCard[] {
    return this.store.workflow.decisions.filter((d) => d.status === 'pending');
  }

  // ─── Reset ─────────────────────────────────────────────────────────────

  reset(): void {
    this.store = this.createEmptyStore();
    this.save();
  }

  getStore(): ChatStore {
    return this.store;
  }
}
