import type { FastifyPluginAsync } from 'fastify';
import { readTasks, getTasksFilePath } from '../services/file-reader.js';

export const tasksRoute: FastifyPluginAsync = async (app) => {
  app.get('/tasks', async (req, reply) => {
    const { projectPath } = app.appState;
    if (!projectPath) {
      return reply.code(400).send({ error: 'No project path configured' });
    }

    const tasksFile = getTasksFilePath(projectPath);
    const tasks = readTasks(projectPath, tasksFile);
    return reply.send(tasks);
  });
};
