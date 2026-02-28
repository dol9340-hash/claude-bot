import type { FastifyPluginAsync } from 'fastify';
import path from 'node:path';
import { validateProject } from '../services/file-reader.js';

export const projectRoute: FastifyPluginAsync = async (app) => {
  app.get('/project', async (req, reply) => {
    const { projectPath } = app.appState;
    if (!projectPath) {
      return reply.send({ path: '', valid: false, hasSessionsFile: false, hasConfigFile: false, hasTasksFile: false, tasksFilePath: '' });
    }

    return reply.send(validateProject(projectPath));
  });

  app.post<{ Body: { path: string } }>('/project', async (req, reply) => {
    const { path: rawPath } = req.body;

    if (!rawPath || typeof rawPath !== 'string') {
      return reply.code(400).send({ error: 'path is required' });
    }

    // Security: block path traversal
    const resolved = path.resolve(rawPath);
    if (resolved.includes('..')) {
      return reply.code(400).send({ error: 'Invalid path' });
    }

    const info = validateProject(resolved);
    if (!info.valid) {
      return reply.code(400).send({ error: 'Directory does not exist', ...info });
    }

    // Update project path and restart watcher
    app.appState.projectPath = resolved;
    app.appState.watcher.start(resolved);

    return reply.send(info);
  });
};
