import type { Task } from '@shared/types';
import StatusBadge from '../common/StatusBadge';

interface TaskItemProps {
  task: Task;
}

export default function TaskItem({ task }: TaskItemProps) {
  const tagEntries = Object.entries(task.tags).filter(([k]) => !['cwd', 'budget', 'turns', 'agent'].includes(k));

  return (
    <div className="flex items-start gap-3 px-4 py-3 border-t border-[var(--border-default)] hover:bg-[var(--bg-elevated)] transition-colors duration-150">
      <div className="pt-0.5">
        <StatusBadge status={task.status} />
      </div>
      <div className="flex-1 min-w-0">
        <div className="font-mono text-[13px] truncate">{task.prompt}</div>
        <div className="flex items-center gap-2 mt-1 flex-wrap">
          <span className="text-xs text-[var(--text-muted)] font-mono">L{task.line}</span>
          {task.agent && (
            <span className="text-xs px-1.5 py-0.5 rounded bg-[var(--bg-overlay)] text-[var(--color-sdk)]">
              @{task.agent}
            </span>
          )}
          {task.retryCount > 0 && (
            <span className="text-xs text-[var(--color-warning)]">
              retry: {task.retryCount}
            </span>
          )}
          {tagEntries.map(([key, val]) => (
            <span
              key={key}
              className="text-xs px-1.5 py-0.5 rounded bg-[var(--bg-overlay)] text-[var(--text-secondary)]"
            >
              {key}:{val}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
