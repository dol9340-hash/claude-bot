import { EventEmitter } from 'node:events';
import type { BotRuntimeInfo } from '../swarm/types.js';

// ─── Event Types ────────────────────────────────────────────────────────────

export interface BotCreatedEvent {
  name: string;
  model: string;
  role?: string;
  timestamp: string;
}

export interface BotCompletedEvent {
  name: string;
  completed: number;
  failed: number;
  costUsd: number;
  timestamp: string;
}

export interface CostUpdateEvent {
  botName: string;
  taskCostUsd: number;
  totalCostUsd: number;
  budgetPercent: number | null;
  timestamp: string;
}

export interface ChatMessageEvent {
  id: string;
  from: string;
  to: string;
  content: string;
  channel: 'main' | 'internal';
  timestamp: string;
  metadata?: {
    type?: 'text' | 'decision' | 'preview' | 'proposal' | 'report';
    options?: string[];
    taskId?: string;
  };
}

export interface BotStatusEvent {
  bots: BotRuntimeInfo[];
  timestamp: string;
}

export interface SwarmEventMap {
  'bot:created': BotCreatedEvent;
  'bot:completed': BotCompletedEvent;
  'bot:status': BotStatusEvent;
  'cost:update': CostUpdateEvent;
  'chat:message': ChatMessageEvent;
  'chat:decision': ChatMessageEvent;
  'swarm:started': { botCount: number; timestamp: string };
  'swarm:completed': { totalCostUsd: number; durationMs: number; timestamp: string };
}

// ─── EventBus ───────────────────────────────────────────────────────────────

export class SwarmEventBus extends EventEmitter {
  emit<K extends keyof SwarmEventMap>(event: K, data: SwarmEventMap[K]): boolean {
    return super.emit(event, data);
  }

  on<K extends keyof SwarmEventMap>(event: K, listener: (data: SwarmEventMap[K]) => void): this {
    return super.on(event, listener);
  }

  off<K extends keyof SwarmEventMap>(event: K, listener: (data: SwarmEventMap[K]) => void): this {
    return super.off(event, listener);
  }

  once<K extends keyof SwarmEventMap>(event: K, listener: (data: SwarmEventMap[K]) => void): this {
    return super.once(event, listener);
  }
}

/** Singleton event bus for the entire application. */
let globalBus: SwarmEventBus | null = null;

export function getEventBus(): SwarmEventBus {
  if (!globalBus) {
    globalBus = new SwarmEventBus();
  }
  return globalBus;
}

export function resetEventBus(): void {
  if (globalBus) {
    globalBus.removeAllListeners();
    globalBus = null;
  }
}
