interface FormatCostProps {
  value: number;
}

export default function FormatCost({ value }: FormatCostProps) {
  return (
    <span className="font-mono">
      ${value.toFixed(value >= 1 ? 2 : 4)}
    </span>
  );
}

export function formatCost(value: number): string {
  return `$${value.toFixed(value >= 1 ? 2 : 4)}`;
}
