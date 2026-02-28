import type { FastifyPluginAsync } from 'fastify';
import { readSessionStore, readConfig, readTasks, getTasksFilePath } from '../services/file-reader.js';
import type { DashboardSummary } from '../../shared/api-types.js';

export const summaryRoute: FastifyPluginAsync = async (app) => {
  app.get('/summary', async (req, reply) => {
    const { projectPath } = app.appState;
    if (!projectPath) {
      return reply.code(400).send({ error: 'No project path configured' });
    }

    const store = readSessionStore(projectPath);
    const config = readConfig(projectPath);
    const tasksFile = getTasksFilePath(projectPath);
    const tasks = readTasks(projectPath, tasksFile);

    const records = store?.records ?? [];

    const completedTasks = tasks.filter((t) => t.status === 'completed').length;
    const failedTasks = tasks.filter((t) => t.status === 'failed').length;
    const pendingTasks = tasks.filter((t) => t.status === 'pending').length;

    const totalCostUsd = store?.totalCostUsd ?? 0;
    const totalDurationMs = records.reduce((sum, r) => sum + r.durationMs, 0);

    const sdkRecords = records.filter((r) => r.engine === 'sdk');
    const cliRecords = records.filter((r) => r.engine === 'cli');

    const maxBudget = config?.maxTotalBudgetUsd;
    const budgetUsagePercent = maxBudget
      ? (totalCostUsd / maxBudget) * 100
      : null;

    const recentSessions = records.slice(-5).reverse();

    const summary: DashboardSummary = {
      totalTasks: tasks.length,
      completedTasks,
      failedTasks,
      pendingTasks,
      totalCostUsd,
      averageCostPerTask: records.length > 0 ? totalCostUsd / records.length : 0,
      averageDurationMs: records.length > 0 ? totalDurationMs / records.length : 0,
      totalDurationMs,
      engineBreakdown: {
        sdk: {
          count: sdkRecords.length,
          costUsd: sdkRecords.reduce((sum, r) => sum + r.costUsd, 0),
        },
        cli: {
          count: cliRecords.length,
          costUsd: cliRecords.reduce((sum, r) => sum + r.costUsd, 0),
        },
      },
      budgetUsagePercent,
      recentSessions,
    };

    return reply.send(summary);
  });
};
