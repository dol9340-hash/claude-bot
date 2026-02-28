import { useApi } from '../hooks/useApi';
import type { ClaudeBotConfig } from '@shared/types';
import ConfigViewer from '../components/config/ConfigViewer';
import LoadingSpinner from '../components/common/LoadingSpinner';
import EmptyState from '../components/common/EmptyState';

export default function ConfigPage() {
  const { data: config, loading } = useApi<Partial<ClaudeBotConfig>>('/api/config');

  if (loading) return <LoadingSpinner />;
  if (!config || Object.keys(config).length === 0) {
    return <EmptyState title="No config" description="No claudebot.config.json found in this project." />;
  }

  return (
    <div>
      <h2 className="text-lg font-semibold mb-4">Configuration</h2>
      <ConfigViewer config={config} />
    </div>
  );
}
