import { useState, useMemo } from 'react';
import { useApi } from '../hooks/useApi';
import { useSSE } from '../hooks/useSSE';
import type { SessionStore } from '@shared/types';
import SessionTable from '../components/sessions/SessionTable';
import SessionFilters, { type SessionFilterState } from '../components/sessions/SessionFilters';
import LoadingSpinner from '../components/common/LoadingSpinner';
import EmptyState from '../components/common/EmptyState';

export default function SessionsPage() {
  const { data: store, loading, refetch } = useApi<SessionStore>('/api/sessions');
  const [filters, setFilters] = useState<SessionFilterState>({ status: 'all', phase: 'all' });

  useSSE({
    onEvent: (type) => {
      if (type === 'config_updated' || type === 'workflow_update') refetch();
    },
  });

  const phases = useMemo(() => {
    if (!store) return [];
    const set = new Set(store.records.map((r) => r.phase));
    return Array.from(set).sort();
  }, [store]);

  if (loading) return <LoadingSpinner />;
  if (!store || store.records.length === 0) {
    return <EmptyState title="No sessions" description="No session records found. Run some tasks first." />;
  }

  return (
    <div>
      <h2 className="text-lg font-semibold mb-4">Session History</h2>
      <SessionFilters filters={filters} onChange={setFilters} phases={phases} />
      <div className="bg-[var(--bg-surface)] border border-[var(--border-default)] rounded-lg p-4">
        <SessionTable records={store.records} filters={filters} />
      </div>
    </div>
  );
}
