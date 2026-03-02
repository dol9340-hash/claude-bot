import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import type { WebSocket } from 'ws';
import type {
  BotStatusDTO,
  ChatMessageDTO,
  DecisionCardDTO,
  HtmlTab,
  WorkflowStateDTO,
  WorkflowStep,
  DecisionStatus,
  WSServerMessage,
} from '../../shared/api-types.js';

interface ChatStore {
  version: 1;
  workflow: WorkflowStateDTO;
  messages: ChatMessageDTO[];
}

/** When message count exceeds this, old messages are archived on save */
const ARCHIVE_THRESHOLD = 500;
/** Number of recent messages to keep in chat.json after archiving */
const KEEP_RECENT = 200;

/**
 * ChatManager — manages WebSocket connections, chat messages,
 * workflow state, and decision cards for the Dashboard.
 */
export class ChatManager {
  private clients = new Set<WebSocket>();
  private store: ChatStore;
  private storePath: string | null = null;
  private archiveDir: string | null = null;

  constructor() {
    this.store = this.createEmptyStore();
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
        epicNumber: 0,
        epics: [],
        autoOnboarding: false,
      },
      messages: [],
    };
  }

  setProjectPath(projectPath: string): void {
    this.storePath = path.join(projectPath, '.claudebot', 'chat.json');
    this.archiveDir = path.join(projectPath, '.claudebot', 'archive');
    this.load();
  }

  private load(): void {
    if (!this.storePath) return;
    try {
      if (fs.existsSync(this.storePath)) {
        this.store = JSON.parse(fs.readFileSync(this.storePath, 'utf-8'));
      }
    } catch {
      this.store = this.createEmptyStore();
    }
  }

  private save(): void {
    if (!this.storePath) return;
    const dir = path.dirname(this.storePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    // Archive old messages when threshold exceeded
    if (this.store.messages.length > ARCHIVE_THRESHOLD) {
      this.archiveOldMessages();
    }

    fs.writeFileSync(this.storePath, JSON.stringify(this.store, null, 2), 'utf-8');
  }

  private archiveOldMessages(): void {
    if (!this.archiveDir) return;

    const toArchive = this.store.messages.slice(0, -KEEP_RECENT);
    this.store.messages = this.store.messages.slice(-KEEP_RECENT);

    if (toArchive.length === 0) return;

    if (!fs.existsSync(this.archiveDir)) {
      fs.mkdirSync(this.archiveDir, { recursive: true });
    }

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const archivePath = path.join(this.archiveDir, `chat-${timestamp}.json`);
    fs.writeFileSync(archivePath, JSON.stringify(toArchive, null, 2), 'utf-8');
  }

  // ─── WebSocket Client Management ───────────────────────────────────────

  addClient(ws: WebSocket): void {
    this.clients.add(ws);
    // Send current state
    this.sendTo(ws, { type: 'workflow', state: this.store.workflow });
    // Send recent messages
    for (const msg of this.store.messages.slice(-50)) {
      this.sendTo(ws, { type: 'chat', message: msg });
    }
  }

  removeClient(ws: WebSocket): void {
    this.clients.delete(ws);
  }

  private broadcast(msg: WSServerMessage): void {
    const data = JSON.stringify(msg);
    for (const ws of this.clients) {
      try {
        ws.send(data);
      } catch {
        this.clients.delete(ws);
      }
    }
  }

  private sendTo(ws: WebSocket, msg: WSServerMessage): void {
    try {
      ws.send(JSON.stringify(msg));
    } catch {
      this.clients.delete(ws);
    }
  }

  // ─── Chat Messages ────────────────────────────────────────────────────

  addMessage(
    role: ChatMessageDTO['role'],
    content: string,
    opts?: { botName?: string; channel?: 'main' | 'internal'; decision?: DecisionCardDTO },
  ): ChatMessageDTO {
    const msg: ChatMessageDTO = {
      id: crypto.randomUUID().slice(0, 8),
      role,
      botName: opts?.botName,
      content,
      channel: opts?.channel ?? 'main',
      timestamp: new Date().toISOString(),
      decision: opts?.decision,
    };

    this.store.messages.push(msg);
    this.save();
    this.broadcast({ type: 'chat', message: msg });

    return msg;
  }

  getMessages(channel?: 'main' | 'internal'): ChatMessageDTO[] {
    if (channel) {
      return this.store.messages.filter((m) => m.channel === channel);
    }
    return this.store.messages;
  }

  /** Paged message retrieval — returns newest-first, offset from the end */
  getMessagesPaged(limit = 50, offset = 0, channel?: 'main' | 'internal'): {
    messages: ChatMessageDTO[];
    total: number;
    hasMore: boolean;
  } {
    let all = this.store.messages;
    if (channel) {
      all = all.filter((m) => m.channel === channel);
    }
    const total = all.length;
    const start = Math.max(0, total - offset - limit);
    const end = Math.max(0, total - offset);
    const messages = all.slice(start, end);
    return { messages, total, hasMore: start > 0 };
  }

  getMessageCount(): number {
    return this.store.messages.length;
  }

  // ─── Workflow State ────────────────────────────────────────────────────

  getWorkflow(): WorkflowStateDTO {
    return this.store.workflow;
  }

  setStep(step: WorkflowStep): void {
    this.store.workflow.step = step;
    this.save();
    this.broadcast({ type: 'workflow', state: this.store.workflow });
  }

  setTopic(topic: string): void {
    this.store.workflow.topic = topic;
    this.save();
  }

  setActiveBots(bots: string[]): void {
    this.store.workflow.activeBots = bots;
    this.save();
    this.broadcast({ type: 'workflow', state: this.store.workflow });
  }

  // ─── Decision Cards ───────────────────────────────────────────────────

  createDecision(
    type: DecisionCardDTO['type'],
    title: string,
    description: string,
    options?: string[],
    tabs?: HtmlTab[],
  ): DecisionCardDTO {
    const card: DecisionCardDTO = {
      id: crypto.randomUUID().slice(0, 8),
      type,
      title,
      description,
      options: options ?? ['Approve', 'Modify', 'Reject'],
      status: 'pending',
      createdAt: new Date().toISOString(),
      ...(tabs && { tabs }),
    };

    this.store.workflow.decisions.push(card);
    this.save();
    this.broadcast({ type: 'decision', card });

    return card;
  }

  resolveDecision(
    decisionId: string,
    status: DecisionStatus,
    response?: string,
  ): DecisionCardDTO | null {
    const card = this.store.workflow.decisions.find((d) => d.id === decisionId);
    if (!card || card.status !== 'pending') return null;

    card.status = status;
    card.response = response;
    card.resolvedAt = new Date().toISOString();
    this.save();
    this.broadcast({ type: 'decision', card });

    return card;
  }

  getPendingDecisions(): DecisionCardDTO[] {
    return this.store.workflow.decisions.filter((d) => d.status === 'pending');
  }

  // ─── Bot Status ─────────────────────────────────────────────────────

  broadcastBots(bots: BotStatusDTO[]): void {
    this.broadcast({ type: 'bots', bots });
  }

  // ─── Epic ────────────────────────────────────────────────────────────

  getEpicNumber(): number {
    return this.store.workflow.epicNumber;
  }

  setAutoOnboarding(auto: boolean): void {
    this.store.workflow.autoOnboarding = auto;
    this.save();
    this.broadcast({ type: 'workflow', state: this.store.workflow });
  }

  completeEpic(summary: import('../../shared/api-types.js').EpicSummary): void {
    this.store.workflow.epics.push(summary);
    this.store.workflow.epicNumber = summary.epicNumber;
    this.store.workflow.completedAt = new Date().toISOString();
    this.save();
    this.broadcast({ type: 'workflow', state: this.store.workflow });
  }

  resetForNextEpic(): void {
    const epicNum = this.store.workflow.epicNumber;
    const epics = this.store.workflow.epics;
    const auto = this.store.workflow.autoOnboarding;
    this.store.workflow = {
      step: 'onboarding',
      topic: '',
      activeBots: [],
      decisions: [],
      startedAt: new Date().toISOString(),
      epicNumber: epicNum,
      epics,
      autoOnboarding: auto,
    };
    this.save();
    this.broadcast({ type: 'workflow', state: this.store.workflow });
  }

  // ─── Reset ────────────────────────────────────────────────────────────

  reset(): void {
    this.store = this.createEmptyStore();
    this.save();
    this.broadcast({ type: 'workflow', state: this.store.workflow });
  }
}
