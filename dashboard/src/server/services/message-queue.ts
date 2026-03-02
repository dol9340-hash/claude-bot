/**
 * MessageQueue — Priority-based message queue for bot coordination.
 * P1 (user) > P2 (error) > P3 (completion) > P4 (progress)
 */

export type MessagePriority = 1 | 2 | 3 | 4;

export interface QueuedMessage {
  id: string;
  priority: MessagePriority;
  content: string;
  source: string;
  handler: () => Promise<void>;
  createdAt: string;
}

export class MessageQueue {
  private queue: QueuedMessage[] = [];
  private processing = false;
  private paused = false;
  private currentTask: Promise<void> | null = null;

  enqueue(msg: QueuedMessage): void {
    this.queue.push(msg);
    // Sort by priority (lower = higher priority)
    this.queue.sort((a, b) => a.priority - b.priority);

    // If a P1 message arrives, interrupt processing
    if (msg.priority === 1 && this.processing) {
      this.paused = true;
    }

    if (!this.processing) {
      void this.process();
    }
  }

  async process(): Promise<void> {
    if (this.processing) return;
    this.processing = true;

    while (this.queue.length > 0) {
      // Check if we need to process P1 first
      if (this.paused) {
        this.paused = false;
        // Re-sort to ensure P1 is first
        this.queue.sort((a, b) => a.priority - b.priority);
      }

      const msg = this.queue.shift();
      if (!msg) break;

      try {
        this.currentTask = msg.handler();
        await this.currentTask;
      } catch {
        // Error logged elsewhere
      } finally {
        this.currentTask = null;
      }
    }

    this.processing = false;
  }

  isProcessing(): boolean {
    return this.processing;
  }

  clear(): void {
    this.queue = [];
    this.processing = false;
    this.paused = false;
  }

  size(): number {
    return this.queue.length;
  }
}
