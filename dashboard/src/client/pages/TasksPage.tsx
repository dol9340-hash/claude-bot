import { useApi } from '../hooks/useApi';
import { useSSE } from '../hooks/useSSE';
import type { Task } from '@shared/types';
import TaskList from '../components/tasks/TaskList';
import LoadingSpinner from '../components/common/LoadingSpinner';
import EmptyState from '../components/common/EmptyState';

export default function TasksPage() {
  const { data: tasks, loading, refetch } = useApi<Task[]>('/api/tasks');

  useSSE({
    onEvent: (type) => {
      if (type === 'tasks_updated') refetch();
    },
  });

  if (loading) return <LoadingSpinner />;
  if (!tasks || tasks.length === 0) {
    return <EmptyState title="No tasks" description="No tasks found. Add tasks to your tasks.md file." />;
  }

  return (
    <div>
      <h2 className="text-lg font-semibold mb-4">Task Queue</h2>
      <TaskList tasks={tasks} />
    </div>
  );
}
