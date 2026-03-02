interface TabStripProps {
  tabs: { label: string }[];
  activeIndex: number;
  onSelect: (index: number) => void;
  accent?: string;
}

export default function TabStrip({ tabs, activeIndex, onSelect, accent = 'var(--color-info)' }: TabStripProps) {
  return (
    <div className="flex gap-1 mb-2" role="tablist">
      {tabs.map((tab, idx) => (
        <button
          key={idx}
          role="tab"
          aria-selected={activeIndex === idx}
          onClick={() => onSelect(idx)}
          className={`px-3 py-1 text-xs font-medium rounded transition-colors ${
            activeIndex === idx
              ? 'text-white'
              : 'bg-[var(--bg-overlay)] text-[var(--text-muted)] hover:text-[var(--text-secondary)]'
          }`}
          style={activeIndex === idx ? { backgroundColor: accent } : undefined}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
}
