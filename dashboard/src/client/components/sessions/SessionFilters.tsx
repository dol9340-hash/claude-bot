import type { TaskStatus, EngineType } from '@shared/types';

export interface SessionFilterState {
  status: TaskStatus | 'all';
  engine: EngineType | 'all';
}

interface SessionFiltersProps {
  filters: SessionFilterState;
  onChange: (filters: SessionFilterState) => void;
}

export default function SessionFilters({ filters, onChange }: SessionFiltersProps) {
  return (
    <div className="flex gap-3 mb-4">
      <div className="flex items-center gap-2">
        <label className="text-xs text-[var(--text-secondary)]">Status:</label>
        <select
          value={filters.status}
          onChange={(e) => onChange({ ...filters, status: e.target.value as SessionFilterState['status'] })}
          className="bg-[var(--bg-elevated)] border border-[var(--border-default)] rounded px-2 py-1 text-xs text-[var(--text-primary)] outline-none focus:border-[var(--color-info)]"
        >
          <option value="all">All</option>
          <option value="completed">Completed</option>
          <option value="failed">Failed</option>
          <option value="pending">Pending</option>
          <option value="running">Running</option>
          <option value="skipped">Skipped</option>
        </select>
      </div>
      <div className="flex items-center gap-2">
        <label className="text-xs text-[var(--text-secondary)]">Engine:</label>
        <select
          value={filters.engine}
          onChange={(e) => onChange({ ...filters, engine: e.target.value as SessionFilterState['engine'] })}
          className="bg-[var(--bg-elevated)] border border-[var(--border-default)] rounded px-2 py-1 text-xs text-[var(--text-primary)] outline-none focus:border-[var(--color-info)]"
        >
          <option value="all">All</option>
          <option value="sdk">SDK</option>
          <option value="cli">CLI</option>
        </select>
      </div>
    </div>
  );
}
