import type { BotMessage } from './types.js';

/**
 * Priority levels for message queue.
 * Lower number = higher priority.
 */
export enum MessagePriority {
  /** User-originated messages (highest priority) */
  USER = 0,
  /** Orchestrator control messages */
  ORCHESTRATOR = 1,
  /** Bot-to-bot task messages */
  BOT_TASK = 2,
  /** Bot-to-bot informational messages */
  BOT_INFO = 3,
}

export interface PrioritizedMessage {
  priority: MessagePriority;
  message: BotMessage;
  enqueuedAt: number;
}

/**
 * PriorityMessageQueue — in-memory MinHeap for bot messages.
 *
 * Ordering: user messages > orchestrator > bot task > bot info.
 * Within same priority, FIFO by enqueue time.
 *
 * Paired with file-based inbox for crash recovery:
 *   - enqueue() writes to both heap and inbox file
 *   - dequeue() removes from heap (inbox cleanup on ack)
 */
export class PriorityMessageQueue {
  private heap: PrioritizedMessage[] = [];

  get size(): number {
    return this.heap.length;
  }

  get isEmpty(): boolean {
    return this.heap.length === 0;
  }

  /** Enqueue a message with the given priority. */
  enqueue(message: BotMessage, priority?: MessagePriority): void {
    const p = priority ?? this.inferPriority(message);
    const entry: PrioritizedMessage = {
      priority: p,
      message,
      enqueuedAt: Date.now(),
    };
    this.heap.push(entry);
    this.bubbleUp(this.heap.length - 1);
  }

  /** Dequeue the highest-priority message (lowest priority number). */
  dequeue(): PrioritizedMessage | undefined {
    if (this.heap.length === 0) return undefined;
    const top = this.heap[0];
    const last = this.heap.pop()!;
    if (this.heap.length > 0) {
      this.heap[0] = last;
      this.sinkDown(0);
    }
    return top;
  }

  /** Peek at the highest-priority message without removing. */
  peek(): PrioritizedMessage | undefined {
    return this.heap[0];
  }

  /** Drain all messages sorted by priority. */
  drainAll(): PrioritizedMessage[] {
    const result: PrioritizedMessage[] = [];
    while (this.heap.length > 0) {
      result.push(this.dequeue()!);
    }
    return result;
  }

  /** Restore queue from inbox file messages (crash recovery). */
  restoreFromMessages(messages: BotMessage[]): void {
    for (const msg of messages) {
      this.enqueue(msg);
    }
  }

  /** Infer priority from message metadata. */
  private inferPriority(message: BotMessage): MessagePriority {
    if (message.from === 'user') return MessagePriority.USER;
    if (message.from === 'orchestrator') return MessagePriority.ORCHESTRATOR;
    if (message.subject.startsWith('TASK:') || message.subject.startsWith('REVIEW:')) {
      return MessagePriority.BOT_TASK;
    }
    return MessagePriority.BOT_INFO;
  }

  // ─── MinHeap operations ──────────────────────────────────────────────────

  private bubbleUp(i: number): void {
    while (i > 0) {
      const parent = Math.floor((i - 1) / 2);
      if (this.compare(i, parent) < 0) {
        this.swap(i, parent);
        i = parent;
      } else {
        break;
      }
    }
  }

  private sinkDown(i: number): void {
    const n = this.heap.length;
    while (true) {
      let smallest = i;
      const left = 2 * i + 1;
      const right = 2 * i + 2;

      if (left < n && this.compare(left, smallest) < 0) smallest = left;
      if (right < n && this.compare(right, smallest) < 0) smallest = right;

      if (smallest !== i) {
        this.swap(i, smallest);
        i = smallest;
      } else {
        break;
      }
    }
  }

  private compare(a: number, b: number): number {
    const ea = this.heap[a];
    const eb = this.heap[b];
    if (ea.priority !== eb.priority) return ea.priority - eb.priority;
    return ea.enqueuedAt - eb.enqueuedAt;
  }

  private swap(a: number, b: number): void {
    [this.heap[a], this.heap[b]] = [this.heap[b], this.heap[a]];
  }
}
