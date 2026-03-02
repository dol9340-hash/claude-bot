import type { FastifyPluginAsync } from 'fastify';
import { readSessionStore, readConfig } from '../services/file-reader.js';
import type { DashboardSummary } from '../../shared/api-types.js';

export const summaryRoute: FastifyPluginAsync = async (app) => {
  app.get('/summary', async (_req, reply) => {
    const { projectPath } = app.appState;
    if (!projectPath) {
      return reply.code(400).send({ error: 'No project path configured' });
    }

    const store = readSessionStore(projectPath);
    const totalCostUsd = store?.totalCostUsd ?? 0;

    const summary: DashboardSummary = {
      totalCostUsd,
      phaseBreakdown: {},
    };

    return reply.send(summary);
  });
};
