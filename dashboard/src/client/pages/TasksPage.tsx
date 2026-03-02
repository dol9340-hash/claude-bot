import { useState, useEffect } from 'react';
import TaskList from '../components/tasks/TaskList';
import type { WorkflowStateDTO } from '@shared/api-types';

export default function TasksPage() {
  const [workflow, setWorkflow] = useState<WorkflowStateDTO | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch('/api/chat/workflow');
        if (res.ok && !cancelled) setWorkflow(await res.json());
      } catch { /* swallow */ }
    })();
    return () => { cancelled = true; };
  }, []);

  const epicNumber = workflow?.epicNumber ?? 0;
  const topic = workflow?.topic ?? '';

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-lg font-semibold text-[var(--text-primary)]">Task Queue</h2>
          {topic && (
            <p className="text-xs text-[var(--text-muted)] mt-0.5">
              {epicNumber > 0 && `Epic #${epicNumber} — `}{topic}
            </p>
          )}
        </div>
        <div className="text-xs text-[var(--text-muted)]">
          Phase: <span className="font-medium text-[var(--text-secondary)]">{workflow?.step ?? 'idle'}</span>
        </div>
      </div>
      <TaskList />

      {/* Epic history */}
      {workflow && workflow.epics.length > 0 && (
        <div className="mt-6">
          <h3 className="text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wide mb-3">
            Completed Epics
          </h3>
          <div className="space-y-2">
            {workflow.epics.map((epic) => (
              <div key={epic.epicNumber}
                className="bg-[var(--bg-surface)] border border-[var(--border-default)] rounded-lg px-4 py-3 flex items-center justify-between">
                <div>
                  <span className="text-xs font-bold text-[var(--color-sdk)]">Epic #{epic.epicNumber}</span>
                  <span className="text-sm text-[var(--text-primary)] ml-2">{epic.topic}</span>
                </div>
                <div className="flex items-center gap-4 text-[10px] text-[var(--text-muted)]">
                  <span>{epic.tasksCompleted} tasks</span>
                  <span>${epic.totalCostUsd.toFixed(4)}</span>
                  <span>{epic.botNames.join(', ')}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
