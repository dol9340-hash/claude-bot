import { useProject } from '../../hooks/useProject';
import { useSSE } from '../../hooks/useSSE';

export default function Header() {
  const { projectPath } = useProject();
  const { connected } = useSSE();

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
