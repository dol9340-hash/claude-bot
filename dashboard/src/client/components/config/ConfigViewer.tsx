import type { ClaudeBotConfig } from '@shared/types';

interface ConfigViewerProps {
  config: Partial<ClaudeBotConfig>;
}

interface ConfigSection {
  title: string;
  items: { label: string; value: string | number | boolean | undefined | null }[];
}

export default function ConfigViewer({ config }: ConfigViewerProps) {
  const sections: ConfigSection[] = [
    {
      title: 'Engine',
      items: [
        { label: 'Engine Type', value: config.engine },
        { label: 'Model', value: config.model },
        { label: 'Permission Mode', value: config.permissionMode },
        { label: 'Allowed Tools', value: config.allowedTools?.join(', ') },
      ],
    },
    {
      title: 'Budget',
      items: [
        { label: 'Max Budget per Task', value: config.maxBudgetPerTaskUsd ? `$${config.maxBudgetPerTaskUsd}` : undefined },
        { label: 'Max Total Budget', value: config.maxTotalBudgetUsd ? `$${config.maxTotalBudgetUsd}` : undefined },
      ],
    },
    {
      title: 'Execution',
      items: [
        { label: 'Tasks File', value: config.tasksFile },
        { label: 'Working Directory', value: config.cwd },
        { label: 'Max Turns per Task', value: config.maxTurnsPerTask },
        { label: 'Task Timeout', value: config.taskTimeoutMs ? `${config.taskTimeoutMs / 1000}s` : undefined },
        { label: 'Max Retries', value: config.maxRetries },
        { label: 'Stop on Failure', value: config.stopOnFailure },
        { label: 'Watch Interval', value: config.watchIntervalMs ? `${config.watchIntervalMs / 1000}s` : undefined },
        { label: 'Log Level', value: config.logLevel },
      ],
    },
    {
      title: 'Swarm',
      items: config.swarm
        ? [
            { label: 'Enabled', value: config.swarm.enabled },
            { label: 'Main Agent', value: config.swarm.mainAgent },
            { label: 'Agents', value: Object.keys(config.swarm.agents).join(', ') },
          ]
        : [{ label: 'Enabled', value: false }],
    },
  ];

  return (
    <div className="space-y-4">
      {sections.map((section) => (
        <div
          key={section.title}
          className="bg-[var(--bg-surface)] border border-[var(--border-default)] rounded-lg p-4"
        >
          <h3 className="text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wide mb-3">
            {section.title}
          </h3>
          <dl className="space-y-2">
            {section.items.map(({ label, value }) => (
              <div key={label} className="flex items-center justify-between">
                <dt className="text-sm text-[var(--text-secondary)]">{label}</dt>
                <dd className="text-sm font-mono text-[var(--text-primary)]">
                  {value === undefined || value === null ? (
                    <span className="text-[var(--text-muted)]">—</span>
                  ) : typeof value === 'boolean' ? (
                    <span style={{ color: value ? 'var(--color-success)' : 'var(--color-danger)' }}>
                      {value ? 'Yes' : 'No'}
                    </span>
                  ) : (
                    String(value)
                  )}
                </dd>
              </div>
            ))}
          </dl>
        </div>
      ))}
    </div>
  );
}
