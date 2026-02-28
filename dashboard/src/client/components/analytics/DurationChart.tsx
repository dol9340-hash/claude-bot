import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import type { SessionRecord } from '@shared/types';
import { formatDuration } from '../common/FormatDuration';

interface DurationChartProps {
  records: SessionRecord[];
}

export default function DurationChart({ records }: DurationChartProps) {
  const data = records.map((r) => ({
    name: `#${r.taskLine}`,
    duration: Number((r.durationMs / 1000).toFixed(1)),
    task: r.taskPrompt.slice(0, 25),
    durationMs: r.durationMs,
  }));

  return (
    <div className="bg-[var(--bg-surface)] border border-[var(--border-default)] rounded-lg p-4">
      <h3 className="text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wide mb-3">
        Duration per Task
      </h3>
      <ResponsiveContainer width="100%" height={250}>
        <BarChart data={data}>
          <CartesianGrid strokeDasharray="3 3" stroke="#30363d" />
          <XAxis dataKey="name" tick={{ fill: '#8b949e', fontSize: 11 }} />
          <YAxis tick={{ fill: '#8b949e', fontSize: 11 }} tickFormatter={(v: number) => `${v}s`} />
          <Tooltip
            contentStyle={{
              background: '#21262d',
              border: '1px solid #30363d',
              borderRadius: '6px',
              color: '#e6edf3',
              fontSize: '12px',
            }}
            formatter={(_value: any, _name: any, props: any) => [
              formatDuration(props?.payload?.durationMs ?? 0),
              'Duration',
            ]}
            labelFormatter={(_label: any, payload: any) =>
              payload?.[0]?.payload?.task ?? ''
            }
          />
          <Bar dataKey="duration" fill="#a371f7" radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
