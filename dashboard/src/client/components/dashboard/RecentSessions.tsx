import type { SessionRecord } from '@shared/types';
import StatusBadge from '../common/StatusBadge';
import EngineBadge from '../common/EngineBadge';
import FormatCost from '../common/FormatCost';
import FormatDuration from '../common/FormatDuration';

interface RecentSessionsProps {
  sessions: SessionRecord[];
}

export default function RecentSessions({ sessions }: RecentSessionsProps) {
  return (
    <div className="bg-[var(--bg-surface)] border border-[var(--border-default)] rounded-lg p-4">
      <h3 className="text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wide mb-3">
        Recent Sessions
      </h3>
      {sessions.length === 0 ? (
        <div className="text-center py-6 text-[var(--text-muted)] text-sm">
          No sessions yet
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-[11px] text-[var(--text-secondary)] uppercase tracking-wider">
                <th className="text-left py-2 pr-3 font-semibold">#</th>
                <th className="text-left py-2 pr-3 font-semibold">Task</th>
                <th className="text-left py-2 pr-3 font-semibold">Status</th>
                <th className="text-right py-2 pr-3 font-semibold">Cost</th>
                <th className="text-right py-2 pr-3 font-semibold">Time</th>
                <th className="text-left py-2 font-semibold">Engine</th>
              </tr>
            </thead>
            <tbody>
              {sessions.map((session, idx) => (
                <tr
                  key={`${session.sessionId}-${idx}`}
                  className="border-t border-[var(--border-default)] hover:bg-[var(--bg-elevated)] transition-colors duration-150"
                >
                  <td className="py-2 pr-3 font-mono text-xs text-[var(--text-muted)]">
                    {session.taskLine}
                  </td>
                  <td className="py-2 pr-3 font-mono text-[13px] truncate max-w-[280px]">
                    {session.taskPrompt}
                  </td>
                  <td className="py-2 pr-3">
                    <StatusBadge status={session.status} />
                  </td>
                  <td className="py-2 pr-3 text-right text-[13px]">
                    <FormatCost value={session.costUsd} />
                  </td>
                  <td className="py-2 pr-3 text-right text-[13px]">
                    <FormatDuration ms={session.durationMs} />
                  </td>
                  <td className="py-2">
                    <EngineBadge engine={session.engine} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
