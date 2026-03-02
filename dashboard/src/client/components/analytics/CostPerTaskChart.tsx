import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import type { SessionRecord } from '@shared/types';

interface CostPerTaskChartProps {
  records: SessionRecord[];
}

const STATUS_COLORS: Record<string, string> = {
  success: '#3fb950',
  failure: '#f85149',
};

export default function CostPerTaskChart({ records }: CostPerTaskChartProps) {
  const data = records.map((r, i) => ({
    name: `#${i + 1}`,
    cost: r.costUsd,
    success: r.success,
    task: r.prompt.slice(0, 25),
    idx: i,
  }));

  return (
    <div className="bg-[var(--bg-surface)] border border-[var(--border-default)] rounded-lg p-4">
      <h3 className="text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wide mb-3">
        Cost per Session
      </h3>
      <ResponsiveContainer width="100%" height={250}>
        <BarChart data={data}>
          <CartesianGrid strokeDasharray="3 3" stroke="#30363d" />
          <XAxis dataKey="name" tick={{ fill: '#8b949e', fontSize: 11 }} />
          <YAxis tick={{ fill: '#8b949e', fontSize: 11 }} tickFormatter={(v: number) => `$${v}`} />
          <Tooltip
            contentStyle={{
              background: '#21262d',
              border: '1px solid #30363d',
              borderRadius: '6px',
              color: '#e6edf3',
              fontSize: '12px',
            }}
            formatter={(value: number) => [`$${Number(value).toFixed(4)}`, 'Cost']}
            labelFormatter={(_label: string, payload: Array<{ payload?: { task?: string } }>) =>
              payload?.[0]?.payload?.task ?? ''
            }
          />
          <Bar dataKey="cost" radius={[4, 4, 0, 0]}>
            {data.map((entry) => (
              <Cell key={entry.idx} fill={entry.success ? STATUS_COLORS.success : STATUS_COLORS.failure} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
