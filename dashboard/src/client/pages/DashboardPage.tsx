import { useApi } from '../hooks/useApi';
import { useSSE } from '../hooks/useSSE';
import type { DashboardSummary } from '@shared/api-types';
import type { ClaudeBotConfig, SessionStore } from '@shared/types';
import SummaryCards from '../components/dashboard/SummaryCards';
import StatusDistribution from '../components/dashboard/StatusDistribution';
import BudgetGauge from '../components/dashboard/BudgetGauge';
import RecentSessions from '../components/dashboard/RecentSessions';
import LoadingSpinner from '../components/common/LoadingSpinner';
import EmptyState from '../components/common/EmptyState';

export default function DashboardPage() {
  const { data: summary, loading, refetch } = useApi<DashboardSummary>('/api/summary');
  const { data: config } = useApi<Partial<ClaudeBotConfig>>('/api/config');
  const { data: store, refetch: refetchStore } = useApi<SessionStore>('/api/sessions');

  useSSE({
    onEvent: (type) => {
      if (type === 'config_updated' || type === 'workflow_update') {
        refetch();
        refetchStore();
      }
    },
  });

  if (loading) return <LoadingSpinner />;
  if (!summary) return <EmptyState title="No data" description="No session data found in this project." />;

  const recentSessions = store?.records?.slice(-5).reverse() ?? [];

  return (
    <div className="space-y-4">
      <SummaryCards summary={summary} />
      <div className="grid grid-cols-2 gap-4">
        <StatusDistribution summary={summary} />
        <BudgetGauge summary={summary} maxBudget={config?.maxTotalBudgetUsd} />
      </div>
      <RecentSessions sessions={recentSessions} />
    </div>
  );
}
