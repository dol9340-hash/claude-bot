import type { FastifyPluginAsync } from 'fastify';
import { buildHealthSnapshot } from '../services/health.js';

export const healthRoute: FastifyPluginAsync = async (app) => {
  app.get('/health', async (_req, reply) => {
    const { projectPath, chatManager } = app.appState;

    return reply.send(buildHealthSnapshot({
      projectPath,
      workflowStep: chatManager.getWorkflow().step,
      messageCount: chatManager.getMessageCount(),
      uptimeSec: process.uptime(),
    }));
  });
};
