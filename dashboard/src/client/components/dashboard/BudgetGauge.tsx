import type { DashboardSummary } from '@shared/api-types';
import { formatCost } from '../common/FormatCost';

interface BudgetGaugeProps {
  summary: DashboardSummary;
  maxBudget?: number;
}

export default function BudgetGauge({ summary, maxBudget }: BudgetGaugeProps) {
  const budget = maxBudget ?? 0;
  const percent = summary.budgetUsagePercent ?? 0;
  const barColor =
    percent > 90
      ? 'var(--color-danger)'
      : percent > 70
        ? 'var(--color-warning)'
        : 'var(--color-success)';

  return (
    <div className="bg-[var(--bg-surface)] border border-[var(--border-default)] rounded-lg p-4">
      <h3 className="text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wide mb-3">
        Budget Usage
      </h3>
      {budget > 0 ? (
        <>
          <div className="flex items-center justify-between mb-2">
            <span className="font-mono text-lg font-semibold" style={{ color: barColor }}>
              {percent.toFixed(1)}%
            </span>
            <span className="text-xs text-[var(--text-secondary)] font-mono">
              {formatCost(summary.totalCostUsd)} / {formatCost(budget)}
            </span>
          </div>
          <div className="w-full h-3 bg-[var(--bg-elevated)] rounded-full overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-300"
              style={{ width: `${Math.min(percent, 100)}%`, backgroundColor: barColor }}
            />
          </div>
        </>
      ) : (
        <div className="flex flex-col items-center py-4 text-[var(--text-muted)] text-sm">
          <div className="font-mono text-lg mb-1">{formatCost(summary.totalCostUsd)}</div>
          <div className="text-xs">No budget limit set</div>
        </div>
      )}
    </div>
  );
}
