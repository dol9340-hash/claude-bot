import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts';
import type { SessionRecord } from '@shared/types';

interface CostTrendChartProps {
  records: SessionRecord[];
  maxBudget?: number;
}

export default function CostTrendChart({ records, maxBudget }: CostTrendChartProps) {
  const sorted = [...records].sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

  let cumulative = 0;
  const data = sorted.map((r) => {
    cumulative += r.costUsd;
    return {
      name: new Date(r.timestamp).toLocaleDateString(),
      cost: Number(cumulative.toFixed(4)),
      task: r.taskPrompt.slice(0, 30),
    };
  });

  return (
    <div className="bg-[var(--bg-surface)] border border-[var(--border-default)] rounded-lg p-4">
      <h3 className="text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wide mb-3">
        Cumulative Cost
      </h3>
      <ResponsiveContainer width="100%" height={250}>
        <LineChart data={data}>
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
            formatter={(value: number) => [`$${value.toFixed(4)}`, 'Cost']}
          />
          {maxBudget && (
            <ReferenceLine y={maxBudget} stroke="#f85149" strokeDasharray="5 5" label={{ value: `Budget $${maxBudget}`, fill: '#f85149', fontSize: 11 }} />
          )}
          <Line type="monotone" dataKey="cost" stroke="#58a6ff" strokeWidth={2} dot={{ fill: '#58a6ff', r: 3 }} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
