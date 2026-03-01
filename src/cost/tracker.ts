import type { CostSummary } from '../types.js';
import type { Logger } from 'pino';

export class CostTracker {
  private totalCostUsd = 0;
  private taskCount = 0;
  private costByModel: Record<string, number> = {};
  private costByBot: Record<string, number> = {};
  private totalInputTokens = 0;
  private totalOutputTokens = 0;
  private maxBudgetUsd: number | undefined;
  private logger: Logger;

  constructor(logger: Logger, maxBudgetUsd?: number) {
    this.logger = logger;
    this.maxBudgetUsd = maxBudgetUsd;
  }

  record(costUsd: number, model?: string, inputTokens?: number, outputTokens?: number): void {
    if (costUsd > 0) {
      this.totalCostUsd += costUsd;
    }
    this.taskCount++;

    if (model && costUsd > 0) {
      this.costByModel[model] = (this.costByModel[model] ?? 0) + costUsd;
    }
    if (inputTokens) this.totalInputTokens += inputTokens;
    if (outputTokens) this.totalOutputTokens += outputTokens;

    this.logger.info({
      taskCost: costUsd > 0 ? costUsd.toFixed(4) : 'N/A',
      totalCost: this.totalCostUsd.toFixed(4),
    }, 'Cost recorded');
  }

  /** Record cost attributed to a specific bot (for per-bot cost tracking). */
  recordForBot(botId: string, costUsd: number, model?: string, inputTokens?: number, outputTokens?: number): void {
    if (costUsd > 0) {
      this.costByBot[botId] = (this.costByBot[botId] ?? 0) + costUsd;
    }
    this.record(costUsd, model, inputTokens, outputTokens);
  }

  isOverBudget(): boolean {
    if (this.maxBudgetUsd === undefined) return false;
    return this.totalCostUsd >= this.maxBudgetUsd;
  }

  remainingBudget(): number | undefined {
    if (this.maxBudgetUsd === undefined) return undefined;
    return Math.max(0, this.maxBudgetUsd - this.totalCostUsd);
  }

  /** Get cost for a specific bot. */
  getBotCost(botId: string): number {
    return this.costByBot[botId] ?? 0;
  }

  getSummary(): CostSummary {
    return {
      totalCostUsd: this.totalCostUsd,
      taskCount: this.taskCount,
      averageCostPerTask: this.taskCount > 0 ? this.totalCostUsd / this.taskCount : 0,
      costByModel: { ...this.costByModel },
      costByBot: { ...this.costByBot },
      totalInputTokens: this.totalInputTokens,
      totalOutputTokens: this.totalOutputTokens,
    };
  }
}
