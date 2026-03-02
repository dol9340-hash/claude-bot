import type { SessionRecord } from '@shared/types';
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
                <th className="text-left py-2 pr-3 font-semibold">Prompt</th>
                <th className="text-left py-2 pr-3 font-semibold">Phase</th>
                <th className="text-left py-2 pr-3 font-semibold">Status</th>
                <th className="text-right py-2 pr-3 font-semibold">Cost</th>
                <th className="text-right py-2 font-semibold">Time</th>
              </tr>
            </thead>
            <tbody>
              {sessions.map((session, idx) => (
                <tr
                  key={`${session.sessionId}-${idx}`}
                  className="border-t border-[var(--border-default)] hover:bg-[var(--bg-elevated)] transition-colors duration-150"
                >
                  <td className="py-2 pr-3 font-mono text-xs text-[var(--text-muted)]">
                    {idx + 1}
                  </td>
                  <td className="py-2 pr-3 font-mono text-[13px] truncate max-w-[280px]">
                    {session.prompt}
                  </td>
                  <td className="py-2 pr-3 text-xs text-[var(--text-secondary)]">
                    {session.phase}
                  </td>
                  <td className="py-2 pr-3">
                    <span
                      className="inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium"
                      style={{
                        color: session.success ? 'var(--color-success)' : 'var(--color-danger)',
                        backgroundColor: session.success ? 'var(--color-success)18' : 'var(--color-danger)18',
                      }}
                    >
                      {session.success ? 'Success' : 'Failed'}
                    </span>
                  </td>
                  <td className="py-2 pr-3 text-right text-[13px]">
                    <FormatCost value={session.costUsd} />
                  </td>
                  <td className="py-2 text-right text-[13px]">
                    <FormatDuration ms={session.durationMs} />
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
