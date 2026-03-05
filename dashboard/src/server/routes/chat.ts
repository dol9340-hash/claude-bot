import type { FastifyPluginAsync } from 'fastify';
import type { WSClientMessage } from '../../shared/api-types.js';

export const chatRoute: FastifyPluginAsync = async (app) => {
  // Use the shared WorkflowEngine from AppState (created in index.ts)
  const engine = app.appState.workflowEngine;

  // REST: get chat history (full or paged)
  app.get('/chat/messages', async (_req, reply) => {
    const { chatManager } = app.appState;
    const q = _req.query as { channel?: string; limit?: string; offset?: string };
    const channel = q.channel as 'main' | 'internal' | undefined;

    if (q.limit) {
      const limit = Math.min(Math.max(1, Number(q.limit) || 50), 200);
      const offset = Math.max(0, Number(q.offset) || 0);
      return reply.send(chatManager.getMessagesPaged(limit, offset, channel));
    }

    return reply.send(chatManager.getMessages(channel));
  });

  // REST: get workflow state
  app.get('/chat/workflow', async (_req, reply) => {
    const { chatManager } = app.appState;
    return reply.send(chatManager.getWorkflow());
  });

  // REST: get pending decisions
  app.get('/chat/decisions', async (_req, reply) => {
    const { chatManager } = app.appState;
    return reply.send(chatManager.getPendingDecisions());
  });

  // REST: post a user message → triggers workflow engine
  app.post<{ Body: { content: string } }>('/chat/send', async (req, reply) => {
    const { chatManager } = app.appState;
    const { content } = req.body;

    if (!content || typeof content !== 'string') {
      return reply.code(400).send({ error: 'content is required' });
    }

    const msg = chatManager.addMessage('user', content);

    // Workflow engine processes the message asynchronously
    setTimeout(() => engine.handleUserMessage(content), 50);

    return reply.send(msg);
  });

  // REST: resolve a decision → triggers workflow progression
  app.post<{ Body: { decisionId: string; status: 'approved' | 'rejected' | 'modified'; response?: string } }>(
    '/chat/decision',
    async (req, reply) => {
      const { chatManager } = app.appState;
      const { decisionId, status, response } = req.body;

      if (!decisionId || !status) {
        return reply.code(400).send({ error: 'decisionId and status are required' });
      }

      const card = chatManager.resolveDecision(decisionId, status, response);
      if (!card) {
        return reply.code(404).send({ error: 'Decision not found or already resolved' });
      }

      // Trigger workflow engine to handle the decision result
      setTimeout(() => engine.handleDecisionResolved(card), 50);

      return reply.send(card);
    },
  );

  // REST: reset workflow
  app.post('/chat/reset', async (_req, reply) => {
    const { projectPath, chatManager, botComposer, messageQueue } = app.appState;
    botComposer.reset();
    messageQueue.clear();
    chatManager.reset();
    engine.reset();
    if (projectPath) {
      engine.initializeProject(projectPath);
    }
    return reply.send({ ok: true });
  });

  // REST: toggle auto-pilot
  app.post<{ Body: { enabled: boolean } }>('/chat/autopilot', async (req, reply) => {
    const { chatManager } = app.appState;
    const { enabled } = req.body;
    chatManager.setAutoOnboarding(!!enabled);
    return reply.send({ autoOnboarding: !!enabled });
  });

  // REST: get bot statuses
  app.get('/chat/bots', async (_req, reply) => {
    const { botComposer } = app.appState;
    const bots = botComposer.getAllBots().map(b => b.status);
    return reply.send(bots);
  });

  // WebSocket: real-time chat
  app.get('/chat/ws', { websocket: true }, (socket, _req) => {
    const { chatManager } = app.appState;

    chatManager.addClient(socket);

    socket.on('message', (raw: Buffer | ArrayBuffer | Buffer[]) => {
      try {
        const msg = JSON.parse(String(raw)) as WSClientMessage;

        if (msg.type === 'chat') {
          chatManager.addMessage('user', msg.content);
          setTimeout(() => engine.handleUserMessage(msg.content), 50);
        } else if (msg.type === 'decision') {
          const card = chatManager.resolveDecision(msg.decisionId, msg.status, msg.response);
          if (card) {
            setTimeout(() => engine.handleDecisionResolved(card), 50);
          }
        }
      } catch {
        socket.send(JSON.stringify({ type: 'error', message: 'Invalid message format' }));
      }
    });

    socket.on('close', () => {
      chatManager.removeClient(socket);
    });
  });
};
