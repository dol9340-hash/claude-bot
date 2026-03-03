import { useProject } from '../../hooks/useProject';
import { useSSE } from '../../hooks/useSSE';
import { useHealth } from '../../hooks/useHealth';

function formatUptime(sec: number): string {
  const s = Math.max(0, Math.floor(sec));
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  const remS = s % 60;
  if (m < 60) return `${m}m ${remS}s`;
  const h = Math.floor(m / 60);
  const remM = m % 60;
  return `${h}h ${remM}m`;
}

export default function Header() {
  const { projectPath } = useProject();
  const { connected } = useSSE();
  const { health, error } = useHealth();

  return (
    <header className="col-span-2 bg-[var(--bg-surface)] border-b border-[var(--border-default)] flex items-center justify-between px-4">
      <div className="flex items-center gap-3">
        <span className="font-semibold text-sm">ClaudeBot Dashboard</span>
        {projectPath && (
          <span className="text-xs text-[var(--text-secondary)] font-mono truncate max-w-md">
            {projectPath}
          </span>
        )}
      </div>
      <div className="flex items-center gap-2 text-xs text-[var(--text-secondary)]">
        {health && !error && (
          <>
            <span className="px-1.5 py-0.5 rounded bg-[var(--bg-overlay)] text-[var(--text-secondary)]">
              {health.workflowStep}
            </span>
            <span className="font-mono text-[var(--text-muted)]">
              up {formatUptime(health.uptimeSec)}
            </span>
          </>
        )}
        <span
          className={`inline-block w-2 h-2 rounded-full ${
            connected ? 'bg-[var(--color-success)]' : 'bg-[var(--color-danger)]'
          }`}
        />
        {connected ? 'Connected' : 'Disconnected'}
      </div>
    </header>
  );
}
