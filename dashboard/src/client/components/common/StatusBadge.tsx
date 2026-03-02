const statusConfig: Record<string, { color: string; icon: string; label: string }> = {
  completed: { color: 'var(--color-success)', icon: '\u2713', label: 'Completed' },
  failed: { color: 'var(--color-danger)', icon: '\u2715', label: 'Failed' },
  running: { color: 'var(--color-warning)', icon: '\u21BB', label: 'Running' },
  pending: { color: 'var(--color-info)', icon: '\u25CB', label: 'Pending' },
  skipped: { color: '#6e7681', icon: '\u2500', label: 'Skipped' },
  success: { color: 'var(--color-success)', icon: '\u2713', label: 'Success' },
};

const defaultStatus = { color: '#6e7681', icon: '?', label: 'Unknown' };

interface StatusBadgeProps {
  status: string;
}

export default function StatusBadge({ status }: StatusBadgeProps) {
  const { color, icon, label } = statusConfig[status] ?? defaultStatus;

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
