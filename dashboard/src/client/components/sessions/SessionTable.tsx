import { useState, useMemo } from 'react';
import type { SessionRecord } from '@shared/types';
import FormatCost from '../common/FormatCost';
import FormatDuration from '../common/FormatDuration';
import type { SessionFilterState } from './SessionFilters';

type SortKey = 'prompt' | 'success' | 'costUsd' | 'durationMs' | 'timestamp' | 'phase';
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
      if (filters.status !== 'all') {
        if (filters.status === 'success' && !r.success) return false;
        if (filters.status === 'failed' && r.success) return false;
      }
      if (filters.phase !== 'all' && r.phase !== filters.phase) return false;
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
      {label} {sortKey === field ? (sortDir === 'asc' ? '\u2191' : '\u2193') : ''}
    </th>
  );

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-[11px] text-[var(--text-secondary)] uppercase tracking-wider">
            <SortHeader label="Prompt" field="prompt" />
            <SortHeader label="Phase" field="phase" />
            <SortHeader label="Status" field="success" />
            <th className="text-left py-2 pr-3 font-semibold">Failure</th>
            <SortHeader label="Cost" field="costUsd" />
            <SortHeader label="Duration" field="durationMs" />
            <SortHeader label="Time" field="timestamp" />
          </tr>
        </thead>
        <tbody>
          {sorted.map((r, idx) => (
            <tr
              key={`${r.sessionId}-${idx}`}
              className="border-t border-[var(--border-default)] hover:bg-[var(--bg-elevated)] transition-colors duration-150"
            >
              <td className="py-2 pr-3 font-mono text-[13px] truncate max-w-[300px]">
                {r.prompt}
              </td>
              <td className="py-2 pr-3 text-xs text-[var(--text-secondary)]">
                {r.phase}
              </td>
              <td className="py-2 pr-3">
                <span
                  className="inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium"
                  style={{
                    color: r.success ? 'var(--color-success)' : 'var(--color-danger)',
                    backgroundColor: r.success ? 'var(--color-success)18' : 'var(--color-danger)18',
                  }}
                >
                  {r.success ? 'Success' : 'Failed'}
                </span>
              </td>
              <td className="py-2 pr-3 text-xs text-[var(--text-secondary)] max-w-[280px]">
                {r.success
                  ? '\u2014'
                  : [r.errorCode, r.failureReason].filter(Boolean).join(': ').substring(0, 160) || '\u2014'}
              </td>
              <td className="py-2 pr-3 text-right text-[13px]">
                <FormatCost value={r.costUsd} />
              </td>
              <td className="py-2 pr-3 text-right text-[13px]">
                <FormatDuration ms={r.durationMs} />
              </td>
              <td className="py-2 pr-3 text-xs text-[var(--text-secondary)] font-mono">
                {new Date(r.timestamp).toLocaleString()}
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
