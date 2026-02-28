import type { CostSummary } from '../types.js';
import type { Logger } from 'pino';

export class CostTracker {
  private totalCostUsd = 0;
  private taskCount = 0;
  private costByModel: Record<string, number> = {};
  private totalInputTokens = 0;
  private totalOutputTokens = 0;
  private maxBudgetUsd: number | undefined;
  private logger: Logger;

  constructor(logger: Logger, maxBudgetUsd?: number) {
    this.logger = logger;
    this.maxBudgetUsd = maxBudgetUsd;
  }

  record(costUsd: number): void {
    if (costUsd > 0) {
      this.totalCostUsd += costUsd;
    }
    this.taskCount++;

    this.logger.info({
      taskCost: costUsd > 0 ? costUsd.toFixed(4) : 'N/A',
      totalCost: this.totalCostUsd.toFixed(4),
    }, 'Cost recorded');
  }

  isOverBudget(): boolean {
    if (this.maxBudgetUsd === undefined) return false;
    return this.totalCostUsd >= this.maxBudgetUsd;
  }

  remainingBudget(): number | undefined {
    if (this.maxBudgetUsd === undefined) return undefined;
    return Math.max(0, this.maxBudgetUsd - this.totalCostUsd);
  }

  getSummary(): CostSummary {
    return {
      totalCostUsd: this.totalCostUsd,
      taskCount: this.taskCount,
      averageCostPerTask: this.taskCount > 0 ? this.totalCostUsd / this.taskCount : 0,
      costByModel: { ...this.costByModel },
      totalInputTokens: this.totalInputTokens,
      totalOutputTokens: this.totalOutputTokens,
    };
  }
}
