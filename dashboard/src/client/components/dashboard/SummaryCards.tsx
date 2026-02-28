import type { DashboardSummary } from '@shared/api-types';
import { formatCost } from '../common/FormatCost';
import { formatDuration } from '../common/FormatDuration';

interface SummaryCardsProps {
  summary: DashboardSummary;
}

interface CardData {
  label: string;
  value: string;
  color: string;
}

export default function SummaryCards({ summary }: SummaryCardsProps) {
  const successRate =
    summary.totalTasks > 0
      ? ((summary.completedTasks / summary.totalTasks) * 100).toFixed(1)
      : '0';

  const cards: CardData[] = [
    {
      label: 'Total Tasks',
      value: String(summary.totalTasks),
      color: 'var(--color-info)',
    },
    {
      label: 'Total Cost',
      value: formatCost(summary.totalCostUsd),
      color: 'var(--color-warning)',
    },
    {
      label: 'Success Rate',
      value: `${successRate}%`,
      color: 'var(--color-success)',
    },
    {
      label: 'Avg Duration',
      value: formatDuration(summary.averageDurationMs),
      color: 'var(--color-sdk)',
    },
  ];

  return (
    <div className="grid grid-cols-4 gap-3">
      {cards.map((card) => (
        <div
          key={card.label}
          className="bg-[var(--bg-surface)] border border-[var(--border-default)] rounded-lg p-4"
        >
          <div
            className="text-[28px] font-bold font-mono"
            style={{ color: card.color }}
          >
            {card.value}
          </div>
          <div className="text-xs text-[var(--text-secondary)] mt-1">
            {card.label}
          </div>
        </div>
      ))}
    </div>
  );
}
