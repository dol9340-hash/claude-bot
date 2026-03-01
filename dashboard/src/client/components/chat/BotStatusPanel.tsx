import type { BotStatusDTO } from '@shared/api-types';

interface BotStatusPanelProps {
  bots: BotStatusDTO[];
}

const statusConfig: Record<string, { color: string; label: string }> = {
  idle: { color: 'var(--text-muted)', label: 'Idle' },
  working: { color: 'var(--color-success)', label: 'Working' },
  waiting: { color: 'var(--color-warning)', label: 'Waiting' },
  error: { color: 'var(--color-danger)', label: 'Error' },
  stopped: { color: 'var(--text-muted)', label: 'Stopped' },
};

export default function BotStatusPanel({ bots }: BotStatusPanelProps) {
  return (
    <div className="bg-[var(--bg-surface)] border border-[var(--border-default)] rounded-lg p-3 h-full overflow-y-auto">
      <h3 className="text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wide mb-3">
        Active Bots
      </h3>
      <div className="space-y-2">
        {bots.map((bot) => {
          const config = statusConfig[bot.status] ?? statusConfig.idle;
          return (
            <div
              key={bot.name}
              className="bg-[var(--bg-elevated)] rounded-md px-3 py-2"
            >
              <div className="flex items-center gap-2 mb-1">
                <span
                  className="w-1.5 h-1.5 rounded-full shrink-0"
                  style={{ backgroundColor: config.color }}
                />
                <span className="text-xs font-medium text-[var(--text-primary)] truncate">
                  {bot.name}
                </span>
              </div>
              <div className="flex items-center justify-between text-[10px] text-[var(--text-muted)]">
                <span style={{ color: config.color }}>{config.label}</span>
                <span>${bot.costUsd.toFixed(4)}</span>
              </div>
              <div className="flex items-center justify-between text-[10px] text-[var(--text-muted)] mt-0.5">
                <span>{bot.tasksCompleted} done</span>
                {bot.tasksFailed > 0 && (
                  <span style={{ color: 'var(--color-danger)' }}>{bot.tasksFailed} failed</span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
