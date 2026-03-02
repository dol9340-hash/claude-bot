import type { DashboardSummary } from '@shared/api-types';

interface StatusDistributionProps {
  summary: DashboardSummary;
}

const PHASE_COLORS: string[] = [
  '#3fb950', '#58a6ff', '#a371f7', '#d29922', '#f85149', '#79c0ff', '#6e7681',
];

export default function StatusDistribution({ summary }: StatusDistributionProps) {
  const phases = Object.entries(summary.phaseBreakdown);

  if (phases.length === 0) {
    return (
      <div className="bg-[var(--bg-surface)] border border-[var(--border-default)] rounded-lg p-4">
        <h3 className="text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wide mb-3">
          Phase Distribution
        </h3>
        <div className="flex items-center justify-center h-48 text-[var(--text-muted)] text-sm">
          No session data
        </div>
      </div>
    );
  }

  return (
    <div className="bg-[var(--bg-surface)] border border-[var(--border-default)] rounded-lg p-4">
      <h3 className="text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wide mb-3">
        Phase Distribution
      </h3>
      <div className="space-y-3">
        {phases.map(([phase, data], idx) => {
          const totalSessions = Object.values(summary.phaseBreakdown).reduce((sum, p) => sum + p.count, 0);
          const percent = totalSessions > 0 ? (data.count / totalSessions) * 100 : 0;
          const color = PHASE_COLORS[idx % PHASE_COLORS.length];

          return (
            <div key={phase}>
              <div className="flex items-center justify-between mb-1">
                <span className="text-sm text-[var(--text-primary)]">{phase}</span>
                <span className="text-xs text-[var(--text-secondary)] font-mono">
                  {data.count} ({percent.toFixed(0)}%)
                </span>
              </div>
              <div className="w-full h-2 bg-[var(--bg-elevated)] rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-300"
                  style={{ width: `${percent}%`, backgroundColor: color }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
