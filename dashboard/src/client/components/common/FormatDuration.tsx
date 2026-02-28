interface FormatDurationProps {
  ms: number;
}

export default function FormatDuration({ ms }: FormatDurationProps) {
  return <span className="font-mono">{formatDuration(ms)}</span>;
}

export function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  const seconds = ms / 1000;
  if (seconds < 60) return `${seconds.toFixed(1)}s`;
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = Math.round(seconds % 60);
  return `${minutes}m ${remainingSeconds}s`;
}
