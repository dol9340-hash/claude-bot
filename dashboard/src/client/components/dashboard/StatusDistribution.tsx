import { PieChart, Pie, Cell, Legend, ResponsiveContainer, Tooltip } from 'recharts';
import type { DashboardSummary } from '@shared/api-types';

interface StatusDistributionProps {
  summary: DashboardSummary;
}

const STATUS_COLORS: Record<string, string> = {
  Completed: '#3fb950',
  Failed: '#f85149',
  Pending: '#58a6ff',
};

export default function StatusDistribution({ summary }: StatusDistributionProps) {
  const data = [
    { name: 'Completed', value: summary.completedTasks },
    { name: 'Failed', value: summary.failedTasks },
    { name: 'Pending', value: summary.pendingTasks },
  ].filter((d) => d.value > 0);

  if (data.length === 0) {
    return (
      <div className="bg-[var(--bg-surface)] border border-[var(--border-default)] rounded-lg p-4">
        <h3 className="text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wide mb-3">
          Status Distribution
        </h3>
        <div className="flex items-center justify-center h-48 text-[var(--text-muted)] text-sm">
          No task data
        </div>
      </div>
    );
  }

  return (
    <div className="bg-[var(--bg-surface)] border border-[var(--border-default)] rounded-lg p-4">
      <h3 className="text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wide mb-3">
        Status Distribution
      </h3>
      <ResponsiveContainer width="100%" height={200}>
        <PieChart>
          <Pie
            data={data}
            cx="50%"
            cy="50%"
            innerRadius={50}
            outerRadius={75}
            dataKey="value"
            stroke="none"
          >
            {data.map((entry) => (
              <Cell key={entry.name} fill={STATUS_COLORS[entry.name] ?? '#6e7681'} />
            ))}
          </Pie>
          <Tooltip
            contentStyle={{
              background: '#21262d',
              border: '1px solid #30363d',
              borderRadius: '6px',
              color: '#e6edf3',
              fontSize: '12px',
            }}
          />
          <Legend
            formatter={(value: string) => (
              <span style={{ color: '#8b949e', fontSize: '12px' }}>{value}</span>
            )}
          />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}
