import type { FastifyPluginAsync } from 'fastify';
import { readPreviewHtml } from '../services/preview-store.js';

export const previewRoute: FastifyPluginAsync = async (app) => {
  app.get<{ Params: { id: string } }>('/preview/:id', async (req, reply) => {
    const projectPath = app.appState.projectPath;
    if (!projectPath) {
      return reply.code(400).send({ error: 'Project path is not set' });
    }

    const html = readPreviewHtml(projectPath, req.params.id);
    if (!html) {
      return reply.code(404).send({ error: 'Preview not found' });
    }

    reply.header('Cache-Control', 'no-store');
    return reply.type('text/html; charset=utf-8').send(html);
  });
};

