import type { FastifyPluginAsync } from 'fastify';

export interface TaskDTO {
  id: string;
  title: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  botName?: string;
  costUsd: number;
  durationMs: number;
  epicNumber: number;
}

export const tasksRoute: FastifyPluginAsync = async (app) => {
  // Tasks derived from bot specs + execution status
  app.get('/tasks', async (_req, reply) => {
    const { chatManager, botComposer } = app.appState;
    const workflow = chatManager.getWorkflow();
    const bots = botComposer.getAllBots();

    const tasks: TaskDTO[] = [];

    for (const bot of bots) {
      for (let i = 0; i < bot.spec.tasks.length; i++) {
        const isCompleted = i < bot.status.tasksCompleted;
        const isFailed = !isCompleted && i < bot.status.tasksCompleted + bot.status.tasksFailed;
        const isRunning = !isCompleted && !isFailed && bot.status.status === 'working' && i === bot.status.tasksCompleted;

        tasks.push({
          id: `${bot.spec.name}-${i}`,
          title: bot.spec.tasks[i].substring(0, 120),
          status: isCompleted ? 'completed' : isFailed ? 'failed' : isRunning ? 'running' : 'pending',
          botName: bot.spec.name,
          costUsd: isCompleted ? (bot.status.costUsd / Math.max(bot.status.tasksCompleted, 1)) : 0,
          durationMs: 0,
          epicNumber: workflow.epicNumber,
        });
      }
    }

    return reply.send(tasks);
  });
};
