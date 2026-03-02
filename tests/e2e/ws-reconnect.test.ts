/**
 * E2E: WebSocket 재연결 시나리오 테스트
 * - 연결 → 초기 상태 수신 → 서버 종료 → 재연결 → 상태 복원 확인
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { WebSocketServer, WebSocket } from 'ws';
import { ChatManager } from '../../dashboard/src/server/services/chat-manager.js';
import { createTestEnv, type TestEnv } from '../helpers/test-env.js';

/** Start a WS server wired to a ChatManager */
function startWsServer(chat: ChatManager, port: number): WebSocketServer {
  const wss = new WebSocketServer({ port });
  wss.on('connection', (ws) => {
    chat.addClient(ws as unknown as import('ws').WebSocket);
    ws.on('close', () => chat.removeClient(ws as unknown as import('ws').WebSocket));
  });
  return wss;
}

/** Connect a ws client and collect received messages */
function connectClient(port: number): Promise<{
  ws: WebSocket;
  messages: unknown[];
}> {
  return new Promise((resolve, reject) => {
    const messages: unknown[] = [];
    const ws = new WebSocket(`ws://127.0.0.1:${port}`);
    ws.on('open', () => resolve({ ws, messages }));
    ws.on('message', (raw) => {
      try { messages.push(JSON.parse(String(raw))); } catch { /* ignore */ }
    });
    ws.on('error', reject);
  });
}

/** Wait for a client to receive at least `n` messages */
async function waitForMessages(
  messages: unknown[],
  n: number,
  timeoutMs = 2000,
): Promise<void> {
  const start = Date.now();
  while (messages.length < n && Date.now() - start < timeoutMs) {
    await new Promise(r => setTimeout(r, 30));
  }
}

/** Close a WebSocketServer and wait for it to fully shut down */
function closeServer(wss: WebSocketServer): Promise<void> {
  return new Promise((resolve, reject) => {
    // Close all connected clients first
    for (const client of wss.clients) {
      client.terminate();
    }
    wss.close((err) => (err ? reject(err) : resolve()));
  });
}

const TEST_PORT = 19876; // High port to avoid conflicts

describe('WebSocket Reconnect', () => {
  let env: TestEnv;

  beforeEach(() => {
    env = createTestEnv({ delayMs: 10 });
  });

  afterEach(() => {
    env.cleanup();
  });

  it('should send workflow state on initial connection', async () => {
    const wss = startWsServer(env.chat, TEST_PORT);
    try {
      const { ws, messages } = await connectClient(TEST_PORT);
      await waitForMessages(messages, 1);

      // First message should be the workflow state
      expect(messages.length).toBeGreaterThanOrEqual(1);
      const first = messages[0] as Record<string, unknown>;
      expect(first.type).toBe('workflow');
      expect(first.state).toBeDefined();
      expect((first.state as Record<string, unknown>).step).toBe('idle');

      ws.close();
    } finally {
      await closeServer(wss);
    }
  });

  it('should send recent messages on reconnection', async () => {
    // Add some chat messages before any connection
    env.chat.addMessage('user', 'Hello');
    env.chat.addMessage('orchestrator', 'Hi!');

    const wss = startWsServer(env.chat, TEST_PORT);
    try {
      const { ws, messages } = await connectClient(TEST_PORT);
      await waitForMessages(messages, 3); // 1 workflow + 2 chat messages

      // Should receive workflow state + 2 chat messages
      const types = (messages as Array<{ type: string }>).map(m => m.type);
      expect(types).toContain('workflow');
      expect(types.filter(t => t === 'chat').length).toBe(2);

      ws.close();
    } finally {
      await closeServer(wss);
    }
  });

  it('should receive live updates from ChatManager', async () => {
    const wss = startWsServer(env.chat, TEST_PORT);
    try {
      const { ws, messages } = await connectClient(TEST_PORT);
      await waitForMessages(messages, 1); // workflow state

      const initialCount = messages.length;

      // Send a message through ChatManager — client should receive it
      env.chat.addMessage('orchestrator', 'Live update!');
      await waitForMessages(messages, initialCount + 1);

      const lastMsg = messages[messages.length - 1] as Record<string, unknown>;
      expect(lastMsg.type).toBe('chat');
      expect((lastMsg.message as Record<string, unknown>).content).toBe('Live update!');

      ws.close();
    } finally {
      await closeServer(wss);
    }
  });

  it('should restore full state after reconnect (server restart)', async () => {
    // Phase 1: connect, add messages, then disconnect
    let wss = startWsServer(env.chat, TEST_PORT);
    const { ws: ws1, messages: msgs1 } = await connectClient(TEST_PORT);
    await waitForMessages(msgs1, 1);

    // Add state through ChatManager
    env.chat.addMessage('user', 'Build a REST API');
    env.chat.setStep('onboarding');
    env.chat.setTopic('REST API');
    await waitForMessages(msgs1, 3); // workflow + chat + workflow update

    ws1.close();
    await closeServer(wss);

    // Small gap to let port free
    await new Promise(r => setTimeout(r, 100));

    // Phase 2: "server restart" — create new WS server with same ChatManager
    wss = startWsServer(env.chat, TEST_PORT);
    try {
      const { ws: ws2, messages: msgs2 } = await connectClient(TEST_PORT);
      await waitForMessages(msgs2, 2); // 1 workflow + 1 chat (recent message)

      // Workflow state should reflect onboarding step
      const workflowMsg = (msgs2 as Array<{ type: string; state?: Record<string, unknown> }>)
        .find(m => m.type === 'workflow');
      expect(workflowMsg).toBeDefined();
      expect(workflowMsg!.state!.step).toBe('onboarding');
      expect(workflowMsg!.state!.topic).toBe('REST API');

      // Chat messages should be resent
      const chatMsgs = (msgs2 as Array<{ type: string; message?: Record<string, unknown> }>)
        .filter(m => m.type === 'chat');
      expect(chatMsgs.length).toBeGreaterThanOrEqual(1);

      ws2.close();
    } finally {
      await closeServer(wss);
    }
  });

  it('should handle multiple concurrent clients', async () => {
    const wss = startWsServer(env.chat, TEST_PORT);
    try {
      // Connect two clients
      const client1 = await connectClient(TEST_PORT);
      const client2 = await connectClient(TEST_PORT);
      await waitForMessages(client1.messages, 1);
      await waitForMessages(client2.messages, 1);

      // Both should receive live updates
      env.chat.addMessage('orchestrator', 'Broadcast!');
      await waitForMessages(client1.messages, 2);
      await waitForMessages(client2.messages, 2);

      const last1 = client1.messages[client1.messages.length - 1] as Record<string, unknown>;
      const last2 = client2.messages[client2.messages.length - 1] as Record<string, unknown>;
      expect((last1.message as Record<string, unknown>).content).toBe('Broadcast!');
      expect((last2.message as Record<string, unknown>).content).toBe('Broadcast!');

      // Disconnect one — other should still work
      client1.ws.close();
      await new Promise(r => setTimeout(r, 50));

      env.chat.addMessage('orchestrator', 'After disconnect');
      await waitForMessages(client2.messages, 3);

      const last2b = client2.messages[client2.messages.length - 1] as Record<string, unknown>;
      expect((last2b.message as Record<string, unknown>).content).toBe('After disconnect');

      client2.ws.close();
    } finally {
      await closeServer(wss);
    }
  });
});
