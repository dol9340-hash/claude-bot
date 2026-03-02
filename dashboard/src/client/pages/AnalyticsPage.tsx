import { useApi } from '../hooks/useApi';
import { useSSE } from '../hooks/useSSE';
import type { SessionStore, ClaudeBotConfig } from '@shared/types';
import type { DashboardSummary } from '@shared/api-types';
import CostTrendChart from '../components/analytics/CostTrendChart';
import CostPerTaskChart from '../components/analytics/CostPerTaskChart';
import DurationChart from '../components/analytics/DurationChart';
import EngineSplitChart from '../components/analytics/EngineSplitChart';
import LoadingSpinner from '../components/common/LoadingSpinner';
import EmptyState from '../components/common/EmptyState';

export default function AnalyticsPage() {
  const { data: store, loading, refetch } = useApi<SessionStore>('/api/sessions');
  const { data: summary, refetch: refetchSummary } = useApi<DashboardSummary>('/api/summary');
  const { data: config } = useApi<Partial<ClaudeBotConfig>>('/api/config');

  useSSE({
    onEvent: (type) => {
      if (type === 'config_updated' || type === 'workflow_update') {
        refetch();
        refetchSummary();
      }
    },
  });

  if (loading) return <LoadingSpinner />;
  if (!store || store.records.length === 0) {
    return <EmptyState title="No analytics data" description="Run some tasks to see analytics." />;
  }

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold">Analytics</h2>
      <div className="grid grid-cols-2 gap-4">
        <CostTrendChart records={store.records} maxBudget={config?.maxTotalBudgetUsd} />
        {summary && <EngineSplitChart summary={summary} />}
      </div>
      <div className="grid grid-cols-2 gap-4">
        <CostPerTaskChart records={store.records} />
        <DurationChart records={store.records} />
      </div>
    </div>
  );
}
