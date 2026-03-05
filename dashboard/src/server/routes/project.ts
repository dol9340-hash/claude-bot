import type { FastifyPluginAsync } from 'fastify';
import path from 'node:path';
import { validateProject } from '../services/file-reader.js';
import { buildExecutorConfig } from '../services/executor-config.js';

export const projectRoute: FastifyPluginAsync = async (app) => {
  app.get('/project', async (_req, reply) => {
    const { projectPath } = app.appState;
    if (!projectPath) {
      return reply.send({ path: '', valid: false, hasConfigFile: false });
    }

    return reply.send(validateProject(projectPath));
  });

  app.post<{ Body: { path: string } }>('/project', async (req, reply) => {
    const { path: rawPath } = req.body;

    if (!rawPath || typeof rawPath !== 'string') {
      return reply.code(400).send({ error: 'path is required' });
    }

    const resolved = path.resolve(rawPath);
    const info = validateProject(resolved);
    if (!info.valid) {
      return reply.code(400).send({ error: 'Directory does not exist', ...info });
    }

    app.appState.projectPath = resolved;
    app.appState.watcher.start(resolved);
    app.appState.chatManager.setProjectPath(resolved);
    app.appState.sessionManager.setProjectPath(resolved);
    app.appState.botComposer.setBaseConfig(buildExecutorConfig(resolved));

    // Start flow should restart from a clean onboarding state on project selection.
    app.appState.messageQueue.clear();
    app.appState.botComposer.reset();
    app.appState.chatManager.reset();
    app.appState.workflowEngine?.reset();
    app.appState.workflowEngine?.initializeProject(resolved);

    return reply.send(info);
  });
};
