import { useState, useCallback, type KeyboardEvent } from 'react';

interface ChatSearchBarProps {
  onSearch: (query: string) => void;
  onFilterBot: (botName: string) => void;
  activeBots?: string[];
}

export default function ChatSearchBar({ onSearch, onFilterBot, activeBots }: ChatSearchBarProps) {
  const [query, setQuery] = useState('');

  const handleKeyDown = useCallback(
    (e: KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'Enter') {
        onSearch(query);
      }
      if (e.key === 'Escape') {
        setQuery('');
        onSearch('');
      }
    },
    [query, onSearch],
  );

  return (
    <div className="flex items-center gap-2 mb-3" role="search" aria-label="Search chat messages">
      <div className="relative flex-1">
        <input
          type="text"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            if (!e.target.value) onSearch('');
          }}
          onKeyDown={handleKeyDown}
          placeholder="Search messages... (Enter to search)"
          className="w-full bg-[var(--bg-elevated)] border border-[var(--border-default)] rounded-md px-3 py-1.5 text-xs text-[var(--text-primary)] placeholder:text-[var(--text-muted)] outline-none focus:border-[var(--color-info)] transition-colors"
          aria-label="Search messages"
        />
        {query && (
          <button
            onClick={() => { setQuery(''); onSearch(''); }}
            className="absolute right-2 top-1/2 -translate-y-1/2 text-[var(--text-muted)] hover:text-[var(--text-primary)] text-xs"
            aria-label="Clear search"
          >
            ✕
          </button>
        )}
      </div>

      {activeBots && activeBots.length > 0 && (
        <select
          onChange={(e) => onFilterBot(e.target.value)}
          className="bg-[var(--bg-elevated)] border border-[var(--border-default)] rounded-md px-2 py-1.5 text-xs text-[var(--text-primary)] outline-none"
          aria-label="Filter by bot"
        >
          <option value="">All bots</option>
          {activeBots.map((bot) => (
            <option key={bot} value={bot}>{bot}</option>
          ))}
        </select>
      )}
    </div>
  );
}
