import { useState, useEffect } from 'react';
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

function formatElapsed(startedAt: string): string {
  const elapsedMs = Date.now() - new Date(startedAt).getTime();
  const totalSec = Math.max(0, Math.floor(elapsedMs / 1000));
  const min = Math.floor(totalSec / 60);
  const sec = totalSec % 60;
  return min > 0 ? `${min}m ${sec}s` : `${sec}s`;
}

export default function BotStatusPanel({ bots }: BotStatusPanelProps) {
  const [expandedBot, setExpandedBot] = useState<string | null>(null);
  const [, setTick] = useState(0);

  // Tick every second to update elapsed time while any bot is working
  useEffect(() => {
    const hasWorking = bots.some((b) => b.status === 'working' && b.taskStartedAt);
    if (!hasWorking) return;
    const id = setInterval(() => setTick((t) => t + 1), 1000);
    return () => clearInterval(id);
  }, [bots]);

  return (
    <div className="bg-[var(--bg-surface)] border border-[var(--border-default)] rounded-lg p-3 h-full overflow-y-auto">
      <h3 className="text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wide mb-3">
        Active Bots
      </h3>
      <div className="space-y-2">
        {bots.map((bot) => {
          const config = statusConfig[bot.status] ?? statusConfig.idle;
          const isExpanded = expandedBot === bot.name;
          const isWorking = bot.status === 'working';

          return (
            <div key={bot.name}>
              <div
                className="bg-[var(--bg-elevated)] rounded-md px-3 py-2 cursor-pointer select-none"
                style={{ transition: 'opacity 0.1s' }}
                onMouseEnter={(e) => (e.currentTarget.style.opacity = '0.85')}
                onMouseLeave={(e) => (e.currentTarget.style.opacity = '1')}
                onClick={() => setExpandedBot(isExpanded ? null : bot.name)}
              >
                <div className="flex items-center gap-2 mb-1">
                  <span
                    className="w-1.5 h-1.5 rounded-full shrink-0"
                    style={{ backgroundColor: config.color }}
                  />
                  <span className="text-xs font-medium text-[var(--text-primary)] truncate flex-1">
                    {bot.name}
                  </span>
                  <span className="text-[9px] text-[var(--text-muted)]">
                    {isExpanded ? '▲' : '▼'}
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

              {isExpanded && (
                <div
                  className="mt-0.5 bg-[var(--bg-elevated)] rounded-md px-3 py-2 text-[10px] space-y-2"
                  style={{ borderLeft: `2px solid ${config.color}` }}
                >
                  {isWorking && bot.currentTask ? (
                    <div>
                      <div className="text-[var(--text-secondary)] font-semibold mb-0.5">현재 작업</div>
                      <div className="text-[var(--text-primary)] leading-snug break-words">
                        {bot.currentTask}
                      </div>
                    </div>
                  ) : null}

                  {bot.currentTaskIndex != null && bot.totalTasks != null && (
                    <div>
                      <div className="flex items-center justify-between text-[var(--text-muted)] mb-1">
                        <span>진행률</span>
                        <span className="text-[var(--text-primary)]">
                          {bot.currentTaskIndex} / {bot.totalTasks}
                        </span>
                      </div>
                      <div className="w-full h-1 bg-[var(--border-default)] rounded overflow-hidden">
                        <div
                          className="h-full rounded transition-all duration-300"
                          style={{
                            width: `${(bot.currentTaskIndex / bot.totalTasks) * 100}%`,
                            backgroundColor: config.color,
                          }}
                        />
                      </div>
                    </div>
                  )}

                  {isWorking && bot.taskStartedAt && (
                    <div className="flex items-center justify-between text-[var(--text-muted)]">
                      <span>경과 시간</span>
                      <span className="text-[var(--text-primary)] tabular-nums">
                        {formatElapsed(bot.taskStartedAt)}
                      </span>
                    </div>
                  )}

                  {bot.lastProgressMessage && (
                    <div>
                      <div className="text-[var(--text-secondary)] font-semibold mb-0.5">최근 로그</div>
                      <div className="text-[var(--text-muted)] leading-snug break-words">
                        {bot.lastProgressMessage}
                      </div>
                    </div>
                  )}

                  {!isWorking && !bot.lastProgressMessage && (
                    <div className="text-center text-[var(--text-muted)] opacity-50 py-1">
                      {bot.status === 'idle' && '대기 중'}
                      {bot.status === 'stopped' && '중단됨'}
                      {bot.status === 'error' && '오류 발생'}
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
