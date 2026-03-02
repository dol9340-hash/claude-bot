/**
 * MessageQueue unit test — priority ordering + P1 interrupt
 */
import { describe, it, expect } from 'vitest';
import { MessageQueue, type QueuedMessage } from '../../dashboard/src/server/services/message-queue.js';

function makeMsg(id: string, priority: 1 | 2 | 3 | 4, handler: () => Promise<void>): QueuedMessage {
  return {
    id,
    priority,
    content: `msg-${id}`,
    source: 'test',
    handler,
    createdAt: new Date().toISOString(),
  };
}

describe('MessageQueue', () => {
  it('should process messages in priority order', async () => {
    const queue = new MessageQueue();
    const order: string[] = [];

    // Use an async handler that yields so all messages get enqueued
    // before processing continues
    const makeAsyncHandler = (id: string) => async () => {
      await new Promise(r => setTimeout(r, 10));
      order.push(id);
    };

    // First message triggers process(), but the async yield lets us
    // enqueue all remaining messages before p4 completes
    queue.enqueue(makeMsg('p4', 4, makeAsyncHandler('p4')));
    queue.enqueue(makeMsg('p2', 2, makeAsyncHandler('p2')));
    queue.enqueue(makeMsg('p1', 1, makeAsyncHandler('p1')));
    queue.enqueue(makeMsg('p3', 3, makeAsyncHandler('p3')));

    // Wait for processing to complete
    await new Promise(r => setTimeout(r, 300));

    // p4 starts first (already processing), then remaining sorted by priority
    expect(order).toEqual(['p4', 'p1', 'p2', 'p3']);
  });

  it('should report correct size', () => {
    const queue = new MessageQueue();
    expect(queue.size()).toBe(0);

    queue.enqueue(makeMsg('a', 3, async () => {}));
    // Processing starts immediately, size may be 0 or 1
    expect(queue.size()).toBeLessThanOrEqual(1);
  });

  it('should clear the queue', () => {
    const queue = new MessageQueue();
    queue.clear();
    expect(queue.size()).toBe(0);
    expect(queue.isProcessing()).toBe(false);
  });
});
