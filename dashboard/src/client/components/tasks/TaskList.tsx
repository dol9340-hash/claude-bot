import { useState, useEffect } from 'react';
import TaskItem from './TaskItem';

interface TaskDTO {
  id: string;
  title: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  botName?: string;
  costUsd: number;
  durationMs: number;
  epicNumber: number;
}

export default function TaskList() {
  const [tasks, setTasks] = useState<TaskDTO[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    const fetchTasks = async () => {
      try {
        const res = await fetch('/api/tasks');
        if (res.ok && !cancelled) {
          setTasks(await res.json());
        }
      } catch { /* swallow */ }
      if (!cancelled) setLoading(false);
    };

    void fetchTasks();

    // Poll every 3 seconds for live updates
    const interval = setInterval(fetchTasks, 3000);
    return () => { cancelled = true; clearInterval(interval); };
  }, []);

  const completed = tasks.filter(t => t.status === 'completed').length;
  const failed = tasks.filter(t => t.status === 'failed').length;
  const running = tasks.filter(t => t.status === 'running').length;

  return (
    <div className="bg-[var(--bg-surface)] border border-[var(--border-default)] rounded-lg">
      <div className="px-4 py-3 flex items-center justify-between">
        <h3 className="text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wide">
          Task Queue
        </h3>
        {tasks.length > 0 && (
          <div className="flex items-center gap-3 text-[10px] text-[var(--text-muted)]">
            {running > 0 && <span style={{ color: 'var(--color-info)' }}>{running} running</span>}
            <span style={{ color: 'var(--color-success)' }}>{completed}/{tasks.length} done</span>
            {failed > 0 && <span style={{ color: 'var(--color-danger)' }}>{failed} failed</span>}
          </div>
        )}
      </div>

      {loading ? (
        <div className="text-center py-8 text-[var(--text-muted)] text-sm">Loading...</div>
      ) : tasks.length === 0 ? (
        <div className="text-center py-8 text-[var(--text-muted)] text-sm">
          No active tasks. Start a workflow in the Chat page to create tasks.
        </div>
      ) : (
        tasks.map(task => (
          <TaskItem
            key={task.id}
            id={task.id}
            title={task.title}
            status={task.status}
            botName={task.botName}
            costUsd={task.costUsd}
          />
        ))
      )}
    </div>
  );
}
