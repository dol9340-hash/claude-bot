import type { FastifyPluginAsync } from 'fastify';
import { readConfig } from '../services/file-reader.js';

export const configRoute: FastifyPluginAsync = async (app) => {
  app.get('/config', async (req, reply) => {
    const { projectPath } = app.appState;
    if (!projectPath) {
      return reply.code(400).send({ error: 'No project path configured' });
    }

    const config = readConfig(projectPath);
    if (!config) {
      return reply.send({});
    }

    return reply.send(config);
  });
};
