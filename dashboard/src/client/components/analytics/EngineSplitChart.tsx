import type { DashboardSummary } from '@shared/api-types';

interface EngineSplitChartProps {
  summary: DashboardSummary;
}

export default function EngineSplitChart({ summary }: EngineSplitChartProps) {
  const phases = Object.entries(summary.phaseBreakdown);

  return (
    <div className="bg-[var(--bg-surface)] border border-[var(--border-default)] rounded-lg p-4">
      <h3 className="text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wide mb-3">
        Phase Breakdown
      </h3>
      {phases.length === 0 ? (
        <div className="flex items-center justify-center h-48 text-[var(--text-muted)] text-sm">
          No phase data yet
        </div>
      ) : (
        <div className="space-y-2">
          {phases.map(([phase, data]) => (
            <div key={phase} className="flex items-center justify-between text-sm">
              <span className="text-[var(--text-primary)] font-mono">{phase}</span>
              <span className="text-[var(--text-secondary)] font-mono">
                {data.count} sessions &middot; ${data.costUsd.toFixed(4)}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
