import type { FastifyPluginAsync } from 'fastify';
import { readSessionStore } from '../services/file-reader.js';

export const sessionsRoute: FastifyPluginAsync = async (app) => {
  app.get('/sessions', async (req, reply) => {
    const { projectPath } = app.appState;
    if (!projectPath) {
      return reply.code(400).send({ error: 'No project path configured' });
    }

    const store = readSessionStore(projectPath);
    if (!store) {
      return reply.send({ version: 1, projectCwd: projectPath, totalCostUsd: 0, records: [] });
    }

    return reply.send(store);
  });
};
