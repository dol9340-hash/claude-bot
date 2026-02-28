import { useState } from 'react';

interface ProjectSelectorProps {
  onSelect: (path: string) => Promise<void>;
  recentProjects: string[];
  error?: string | null;
}

export default function ProjectSelector({ onSelect, recentProjects, error }: ProjectSelectorProps) {
  const [inputPath, setInputPath] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!inputPath.trim()) return;
    setLoading(true);
    try {
      await onSelect(inputPath.trim());
    } finally {
      setLoading(false);
    }
  }

  async function handleRecentClick(projectPath: string) {
    setLoading(true);
    try {
      await onSelect(projectPath);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="max-w-lg mx-auto">
      <form onSubmit={handleSubmit} className="mb-6">
        <label className="block text-xs text-[var(--text-secondary)] mb-2">
          Project folder path
        </label>
        <div className="flex gap-2">
          <input
            type="text"
            value={inputPath}
            onChange={(e) => setInputPath(e.target.value)}
            placeholder="/path/to/your/project"
            className="flex-1 bg-[var(--bg-elevated)] border border-[var(--border-default)] rounded px-3 py-2 text-sm font-mono text-[var(--text-primary)] placeholder:text-[var(--text-muted)] outline-none focus:border-[var(--color-info)]"
            disabled={loading}
          />
          <button
            type="submit"
            disabled={loading || !inputPath.trim()}
            className="px-4 py-2 bg-[var(--color-info)] text-white text-sm rounded font-medium hover:opacity-90 disabled:opacity-50 transition-opacity"
          >
            {loading ? '...' : 'Open'}
          </button>
        </div>
        {error && (
          <p className="mt-2 text-xs text-[var(--color-danger)]">{error}</p>
        )}
      </form>

      {recentProjects.length > 0 && (
        <div>
          <h4 className="text-xs text-[var(--text-secondary)] mb-2">Recent Projects</h4>
          <div className="space-y-1">
            {recentProjects.map((p) => (
              <button
                key={p}
                onClick={() => handleRecentClick(p)}
                disabled={loading}
                className="w-full text-left px-3 py-2 text-sm font-mono text-[var(--text-primary)] bg-[var(--bg-surface)] border border-[var(--border-default)] rounded hover:bg-[var(--bg-elevated)] transition-colors duration-150 disabled:opacity-50 truncate"
              >
                {p}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
