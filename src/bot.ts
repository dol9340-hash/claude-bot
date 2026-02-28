import type { Logger } from 'pino';
import type { Task, TaskResult, ClaudeBotConfig } from './types.js';
import { parseTasks } from './task/parser.js';
import { updateTaskInFile } from './task/writer.js';
import { createExecutor } from './engine/factory.js';
import { SessionManager } from './session/manager.js';
import { CostTracker } from './cost/tracker.js';
import { withRetry } from './utils/retry.js';
import type { IExecutor } from './engine/types.js';

export interface BotRunResult {
  totalTasks: number;
  completed: number;
  failed: number;
  skipped: number;
  totalCostUsd: number;
  totalDurationMs: number;
  results: TaskResult[];
}

export class ClaudeBot {
  private config: ClaudeBotConfig;
  private logger: Logger;
  private sessionManager: SessionManager;
  private costTracker: CostTracker;
  private executor: IExecutor;
  private aborted = false;

  constructor(config: ClaudeBotConfig, logger: Logger) {
    this.config = config;
    this.logger = logger;
    this.sessionManager = new SessionManager(
      config.sessionStorePath,
      config.cwd,
      logger,
    );
    this.costTracker = new CostTracker(logger, config.maxTotalBudgetUsd);
    this.executor = createExecutor(config.engine);

    this.logger.info({ engine: config.engine }, 'ClaudeBot initialized');
  }

  /**
   * Main entry point: runs the task queue in a continuous watch loop.
   * 1. Read docs/todo.md and execute pending tasks one by one
   * 2. Mark each task [x] on completion
   * 3. When all tasks are done, wait 20s and check again
   * 4. Repeat until aborted (Ctrl+C)
   */
  async run(): Promise<BotRunResult> {
    const startTime = Date.now();
    const allResults: TaskResult[] = [];
    const watchInterval = this.config.watchIntervalMs;

    this.logger.info({
      tasksFile: this.config.tasksFile,
      engine: this.config.engine,
      watchIntervalMs: watchInterval,
    }, 'ClaudeBot started (watch mode)');

    while (!this.aborted) {
      // Check budget before each cycle
      if (this.costTracker.isOverBudget()) {
        this.logger.warn({
          totalCost: this.costTracker.getSummary().totalCostUsd,
          budget: this.config.maxTotalBudgetUsd,
        }, 'Global budget exceeded, stopping');
        break;
      }

      const tasks = parseTasks(this.config.tasksFile);

      if (tasks.length === 0) {
        if (watchInterval <= 0) {
          this.logger.info('No pending tasks. Watch mode disabled, exiting.');
          break;
        }
        this.logger.info(
          { nextCheckIn: `${watchInterval / 1000}s` },
          'No pending tasks. Waiting...',
        );
        await this.sleep(watchInterval);
        continue;
      }

      this.logger.info({ taskCount: tasks.length }, 'Pending tasks found');

      for (const task of tasks) {
        if (this.aborted) break;
        if (this.costTracker.isOverBudget()) break;

        let result: TaskResult;
        try {
          result = await this.executeWithRetry(task);
        } catch (err) {
          this.logger.error({ taskLine: task.line, error: String(err) }, 'Task execution error');
          result = {
            task,
            success: false,
            result: String(err),
            costUsd: 0,
            durationMs: 0,
            sessionId: '',
            errors: [String(err)],
          };
        }
        allResults.push(result);

        // Update the markdown file
        task.status = result.success ? 'completed' : 'failed';
        updateTaskInFile(this.config.tasksFile, task);

        // Record session & cost
        this.sessionManager.recordResult(result, this.config.engine);
        this.costTracker.record(result.costUsd);

        if (result.success) {
          this.logger.info({
            taskLine: task.line,
            cost: result.costUsd > 0 ? `$${result.costUsd.toFixed(4)}` : 'N/A',
            duration: `${(result.durationMs / 1000).toFixed(1)}s`,
          }, 'Task completed');
        } else {
          this.logger.error({
            taskLine: task.line,
            errors: result.errors,
            cost: result.costUsd > 0 ? `$${result.costUsd.toFixed(4)}` : 'N/A',
          }, 'Task failed');

          if (this.config.stopOnFailure) {
            this.logger.warn('stopOnFailure enabled, halting queue');
            this.aborted = true;
            break;
          }
        }
      }
    }

    // Print summary
    const summary = this.costTracker.getSummary();
    const completed = allResults.filter(r => r.success).length;
    const failed = allResults.filter(r => !r.success).length;

    this.logger.info({
      totalTasks: allResults.length,
      completed,
      failed,
      totalCost: `$${summary.totalCostUsd.toFixed(4)}`,
      totalDuration: `${((Date.now() - startTime) / 1000).toFixed(1)}s`,
    }, 'ClaudeBot stopped');

    return {
      totalTasks: allResults.length,
      completed,
      failed,
      skipped: 0,
      totalCostUsd: summary.totalCostUsd,
      totalDurationMs: Date.now() - startTime,
      results: allResults,
    };
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => {
      const timer = setTimeout(resolve, ms);
      // Allow abort to break out of sleep
      const check = () => {
        if (this.aborted) {
          clearTimeout(timer);
          resolve();
        }
      };
      setTimeout(check, 1000);
    });
  }

  private async executeWithRetry(task: Task): Promise<TaskResult> {
    return withRetry(
      async (attempt) => {
        task.retryCount = attempt;
        task.status = 'running';
        return this.executor.execute(task, this.config, this.logger);
      },
      (_error, result) => {
        if (!result) return true;
        if (result.success) return false;
        if (this.aborted) return false;
        if (this.costTracker.isOverBudget()) return false;
        return true;
      },
      {
        maxRetries: this.config.maxRetries,
        logger: this.logger,
      },
    );
  }

  abort(): void {
    this.aborted = true;
    this.logger.info('Abort requested, will stop after current task');
  }

  private emptyResult(): BotRunResult {
    return {
      totalTasks: 0,
      completed: 0,
      failed: 0,
      skipped: 0,
      totalCostUsd: 0,
      totalDurationMs: 0,
      results: [],
    };
  }
}
