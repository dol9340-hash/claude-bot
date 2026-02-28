import { useState, useMemo } from 'react';
import type { Task, TaskStatus } from '@shared/types';
import TaskItem from './TaskItem';

type TabFilter = 'all' | TaskStatus;

interface TaskListProps {
  tasks: Task[];
}

const TABS: { key: TabFilter; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'pending', label: 'Pending' },
  { key: 'completed', label: 'Completed' },
  { key: 'failed', label: 'Failed' },
];

export default function TaskList({ tasks }: TaskListProps) {
  const [activeTab, setActiveTab] = useState<TabFilter>('all');

  const filtered = useMemo(() => {
    if (activeTab === 'all') return tasks;
    return tasks.filter((t) => t.status === activeTab);
  }, [tasks, activeTab]);

  return (
    <div className="bg-[var(--bg-surface)] border border-[var(--border-default)] rounded-lg">
      <div className="flex border-b border-[var(--border-default)]">
        {TABS.map((tab) => {
          const count = tab.key === 'all' ? tasks.length : tasks.filter((t) => t.status === tab.key).length;
          return (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`px-4 py-2.5 text-xs font-medium transition-colors duration-150 border-b-2 ${
                activeTab === tab.key
                  ? 'border-[var(--color-info)] text-[var(--text-primary)]'
                  : 'border-transparent text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
              }`}
            >
              {tab.label} ({count})
            </button>
          );
        })}
      </div>
      <div>
        {filtered.length === 0 ? (
          <div className="text-center py-8 text-[var(--text-muted)] text-sm">
            No tasks in this category
          </div>
        ) : (
          filtered.map((task) => <TaskItem key={task.line} task={task} />)
        )}
      </div>
    </div>
  );
}
