interface TaskItemProps {
  id: string;
  title: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  botName?: string;
  costUsd: number;
}

const statusConfig: Record<string, { color: string; icon: string; label: string }> = {
  pending: { color: 'var(--text-muted)', icon: '\u25CB', label: 'Pending' },
  running: { color: 'var(--color-info)', icon: '\u25CF', label: 'Running' },
  completed: { color: 'var(--color-success)', icon: '\u2713', label: 'Done' },
  failed: { color: 'var(--color-danger)', icon: '\u2717', label: 'Failed' },
};

export default function TaskItem({ id, title, status, botName, costUsd }: TaskItemProps) {
  const config = statusConfig[status] ?? statusConfig.pending;

  return (
    <div className="flex items-center gap-3 px-4 py-3 border-t border-[var(--border-default)]">
      <span
        className="text-sm font-bold flex-shrink-0 w-5 text-center"
        style={{ color: config.color }}
      >
        {config.icon}
      </span>
      <div className="flex-1 min-w-0">
        <p className="text-sm text-[var(--text-primary)] truncate">{title}</p>
        <div className="flex items-center gap-2 mt-0.5">
          {botName && (
            <span className="text-[10px] text-[var(--text-muted)]">{botName}</span>
          )}
          <span className="text-[10px] px-1.5 py-0.5 rounded"
            style={{ color: config.color, background: `color-mix(in srgb, ${config.color} 15%, transparent)` }}>
            {config.label}
          </span>
        </div>
      </div>
      {costUsd > 0 && (
        <span className="text-[10px] text-[var(--text-muted)] flex-shrink-0">
          ${costUsd.toFixed(4)}
        </span>
      )}
    </div>
  );
}
