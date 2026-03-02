import { useState, useEffect } from 'react';
import type { DecisionCardDTO } from '@shared/api-types';
import HtmlPreview from './HtmlPreview';
import TabStrip from './TabStrip';

interface DecisionCardProps {
  card: DecisionCardDTO;
  onResolve: (id: string, status: 'approved' | 'rejected' | 'modified', response?: string) => void;
}

const typeConfig: Record<string, { icon: string; accent: string }> = {
  prediction:    { icon: '\u25C8', accent: 'var(--color-info)' },
  documentation: { icon: '\uD83D\uDCC4', accent: 'var(--color-sdk)' },
  proposal:      { icon: '\uD83E\uDD16', accent: 'var(--color-sdk)' },
  review:        { icon: '\u2713', accent: 'var(--color-success)' },
  question:      { icon: '?', accent: 'var(--color-warning)' },
};

export default function DecisionCard({ card, onResolve }: DecisionCardProps) {
  const [response, setResponse] = useState('');
  const [showModify, setShowModify] = useState(false);
  const [activeTab, setActiveTab] = useState(0);
  const config = typeConfig[card.type] ?? typeConfig.question;
  const hasTabs = card.tabs && card.tabs.length > 0;

  useEffect(() => {
    setActiveTab(0);
  }, [card.id, card.tabs?.length]);

  return (
    <div
      className="bg-[var(--bg-surface)] border rounded-lg p-4"
      style={{ borderColor: config.accent }}
    >
      <div className="flex items-start gap-3">
        <span className="text-lg">{config.icon}</span>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs font-semibold uppercase tracking-wide" style={{ color: config.accent }}>
              {card.type}
            </span>
            <span className="text-[10px] text-[var(--text-muted)]">
              {new Date(card.createdAt).toLocaleTimeString()}
            </span>
          </div>
          <h4 className="text-sm font-semibold text-[var(--text-primary)] mb-1">{card.title}</h4>
          <p className="text-xs text-[var(--text-secondary)] whitespace-pre-wrap mb-2">{card.description}</p>

          {hasTabs && (
            <div className="mb-3">
              {card.tabs!.length > 1 && (
                <TabStrip
                  tabs={card.tabs!}
                  activeIndex={activeTab}
                  onSelect={setActiveTab}
                  accent={config.accent}
                />
              )}
              <HtmlPreview
                html={card.tabs![activeTab]?.html ?? ''}
                label={card.tabs!.length === 1 ? 'PREVIEW' : undefined}
                maxHeight={380}
              />
            </div>
          )}

          {showModify && (
            <textarea
              value={response}
              onChange={(e) => setResponse(e.target.value)}
              placeholder="Describe your modifications..."
              rows={2}
              className="w-full mb-2 bg-[var(--bg-elevated)] border border-[var(--border-default)] rounded px-2.5 py-1.5 text-xs text-[var(--text-primary)] placeholder:text-[var(--text-muted)] resize-none outline-none focus:border-[var(--color-info)]"
            />
          )}

          <div className="flex gap-2">
            <button
              onClick={() => onResolve(card.id, 'approved')}
              className="px-3 py-1.5 bg-[var(--color-success)] text-white text-xs font-medium rounded hover:opacity-90 transition-opacity"
            >
              Approve
            </button>
            <button
              onClick={() => {
                if (showModify) {
                  onResolve(card.id, 'modified', response);
                } else {
                  setShowModify(true);
                }
              }}
              className="px-3 py-1.5 bg-[var(--color-warning)] text-white text-xs font-medium rounded hover:opacity-90 transition-opacity"
            >
              Modify
            </button>
            <button
              onClick={() => onResolve(card.id, 'rejected')}
              className="px-3 py-1.5 bg-[var(--color-danger)] text-white text-xs font-medium rounded hover:opacity-90 transition-opacity"
            >
              Reject
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
