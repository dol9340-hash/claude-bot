import type { DashboardSummary } from '@shared/api-types';
import { formatCost } from '../common/FormatCost';

interface SummaryCardsProps {
  summary: DashboardSummary;
}

interface CardData {
  label: string;
  value: string;
  color: string;
}

export default function SummaryCards({ summary }: SummaryCardsProps) {
  const totalSessions = Object.values(summary.phaseBreakdown).reduce((sum, p) => sum + p.count, 0);

  const cards: CardData[] = [
    {
      label: 'Total Cost',
      value: formatCost(summary.totalCostUsd),
      color: 'var(--color-warning)',
    },
    {
      label: 'Total Sessions',
      value: String(totalSessions),
      color: 'var(--color-info)',
    },
    {
      label: 'Phases',
      value: String(Object.keys(summary.phaseBreakdown).length),
      color: 'var(--color-success)',
    },
  ];

  return (
    <div className="grid grid-cols-3 gap-3">
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
