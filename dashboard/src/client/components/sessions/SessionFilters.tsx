export interface SessionFilterState {
  status: string;
  phase: string;
}

interface SessionFiltersProps {
  filters: SessionFilterState;
  onChange: (filters: SessionFilterState) => void;
  phases: string[];
}

export default function SessionFilters({ filters, onChange, phases }: SessionFiltersProps) {
  return (
    <div className="flex gap-3 mb-4">
      <div className="flex items-center gap-2">
        <label className="text-xs text-[var(--text-secondary)]">Status:</label>
        <select
          value={filters.status}
          onChange={(e) => onChange({ ...filters, status: e.target.value })}
          className="bg-[var(--bg-elevated)] border border-[var(--border-default)] rounded px-2 py-1 text-xs text-[var(--text-primary)] outline-none focus:border-[var(--color-info)]"
        >
          <option value="all">All</option>
          <option value="success">Success</option>
          <option value="failed">Failed</option>
        </select>
      </div>
      <div className="flex items-center gap-2">
        <label className="text-xs text-[var(--text-secondary)]">Phase:</label>
        <select
          value={filters.phase}
          onChange={(e) => onChange({ ...filters, phase: e.target.value })}
          className="bg-[var(--bg-elevated)] border border-[var(--border-default)] rounded px-2 py-1 text-xs text-[var(--text-primary)] outline-none focus:border-[var(--color-info)]"
        >
          <option value="all">All</option>
          {phases.map((phase) => (
            <option key={phase} value={phase}>{phase}</option>
          ))}
        </select>
      </div>
    </div>
  );
}
