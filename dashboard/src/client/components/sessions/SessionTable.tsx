import { useState, useMemo } from 'react';
import type { SessionRecord } from '@shared/types';
import StatusBadge from '../common/StatusBadge';
import EngineBadge from '../common/EngineBadge';
import FormatCost from '../common/FormatCost';
import FormatDuration from '../common/FormatDuration';
import type { SessionFilterState } from './SessionFilters';

type SortKey = 'taskLine' | 'status' | 'costUsd' | 'durationMs' | 'timestamp' | 'engine';
type SortDir = 'asc' | 'desc';

interface SessionTableProps {
  records: SessionRecord[];
  filters: SessionFilterState;
}

export default function SessionTable({ records, filters }: SessionTableProps) {
  const [sortKey, setSortKey] = useState<SortKey>('timestamp');
  const [sortDir, setSortDir] = useState<SortDir>('desc');

  const filtered = useMemo(() => {
    return records.filter((r) => {
      if (filters.status !== 'all' && r.status !== filters.status) return false;
      if (filters.engine !== 'all' && r.engine !== filters.engine) return false;
      return true;
    });
  }, [records, filters]);

  const sorted = useMemo(() => {
    return [...filtered].sort((a, b) => {
      const aVal = a[sortKey];
      const bVal = b[sortKey];
      const cmp = aVal < bVal ? -1 : aVal > bVal ? 1 : 0;
      return sortDir === 'asc' ? cmp : -cmp;
    });
  }, [filtered, sortKey, sortDir]);

  function handleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      setSortDir('desc');
    }
  }

  const SortHeader = ({ label, field }: { label: string; field: SortKey }) => (
    <th
      className="text-left py-2 pr-3 font-semibold cursor-pointer hover:text-[var(--text-primary)] select-none"
      onClick={() => handleSort(field)}
    >
      {label} {sortKey === field ? (sortDir === 'asc' ? '↑' : '↓') : ''}
    </th>
  );

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-[11px] text-[var(--text-secondary)] uppercase tracking-wider">
            <SortHeader label="Line" field="taskLine" />
            <th className="text-left py-2 pr-3 font-semibold">Task</th>
            <SortHeader label="Status" field="status" />
            <SortHeader label="Cost" field="costUsd" />
            <SortHeader label="Duration" field="durationMs" />
            <SortHeader label="Engine" field="engine" />
            <SortHeader label="Time" field="timestamp" />
            <th className="text-left py-2 pr-3 font-semibold">Retry</th>
          </tr>
        </thead>
        <tbody>
          {sorted.map((r, idx) => (
            <tr
              key={`${r.sessionId}-${idx}`}
              className="border-t border-[var(--border-default)] hover:bg-[var(--bg-elevated)] transition-colors duration-150"
            >
              <td className="py-2 pr-3 font-mono text-xs text-[var(--text-muted)]">
                {r.taskLine}
              </td>
              <td className="py-2 pr-3 font-mono text-[13px] truncate max-w-[300px]">
                {r.taskPrompt}
              </td>
              <td className="py-2 pr-3">
                <StatusBadge status={r.status} />
              </td>
              <td className="py-2 pr-3 text-right text-[13px]">
                <FormatCost value={r.costUsd} />
              </td>
              <td className="py-2 pr-3 text-right text-[13px]">
                <FormatDuration ms={r.durationMs} />
              </td>
              <td className="py-2 pr-3">
                <EngineBadge engine={r.engine} />
              </td>
              <td className="py-2 pr-3 text-xs text-[var(--text-secondary)] font-mono">
                {new Date(r.timestamp).toLocaleString()}
              </td>
              <td className="py-2 pr-3 text-xs text-[var(--text-muted)] font-mono">
                {r.retryCount > 0 ? r.retryCount : '—'}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {sorted.length === 0 && (
        <div className="text-center py-8 text-[var(--text-muted)] text-sm">
          No matching sessions
        </div>
      )}
    </div>
  );
}
