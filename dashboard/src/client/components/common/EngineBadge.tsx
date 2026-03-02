interface EngineBadgeProps {
  engine: string;
}

export default function EngineBadge({ engine }: EngineBadgeProps) {
  const isSDK = engine === 'sdk';
  const color = isSDK ? 'var(--color-sdk)' : 'var(--color-cli)';
  const label = isSDK ? 'SDK' : 'CLI';

  return (
    <span
      className="inline-flex items-center px-2 py-0.5 rounded-md text-xs font-semibold font-mono"
      style={{ color, backgroundColor: `${color}18`, border: `1px solid ${color}40` }}
    >
      {label}
    </span>
  );
}
