import type { TaskStatus } from '@shared/types';

const statusConfig: Record<TaskStatus, { color: string; icon: string; label: string }> = {
  completed: { color: 'var(--color-success)', icon: '✓', label: 'Completed' },
  failed: { color: 'var(--color-danger)', icon: '✕', label: 'Failed' },
  running: { color: 'var(--color-warning)', icon: '↻', label: 'Running' },
  pending: { color: 'var(--color-info)', icon: '○', label: 'Pending' },
  skipped: { color: '#6e7681', icon: '─', label: 'Skipped' },
};

interface StatusBadgeProps {
  status: TaskStatus;
}

export default function StatusBadge({ status }: StatusBadgeProps) {
  const { color, icon, label } = statusConfig[status] ?? statusConfig.pending;

  return (
    <span
      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-medium"
      style={{ color, backgroundColor: `${color}18`, border: `1px solid ${color}40` }}
    >
      <span>{icon}</span>
      {label}
    </span>
  );
}
