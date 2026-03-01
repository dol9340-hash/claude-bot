import { useEffect, useRef, useState, useCallback } from 'react';
import type { ChatMessageDTO } from '@shared/api-types';

interface ChatTimelineProps {
  messages: ChatMessageDTO[];
  channel?: 'main' | 'internal' | 'all';
  searchQuery?: string;
  filterBot?: string;
}

const roleConfig: Record<string, { color: string; label: string }> = {
  user: { color: 'var(--color-info)', label: 'You' },
  orchestrator: { color: 'var(--color-sdk)', label: 'Orchestrator' },
  bot: { color: 'var(--color-cli)', label: 'Bot' },
  system: { color: 'var(--text-muted)', label: 'System' },
};

export default function ChatTimeline({ messages, channel = 'all', searchQuery, filterBot }: ChatTimelineProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const endRef = useRef<HTMLDivElement>(null);
  const [isAutoScroll, setIsAutoScroll] = useState(true);
  const [newMsgCount, setNewMsgCount] = useState(0);
  const prevLenRef = useRef(messages.length);

  // Filter messages by channel, search, and bot
  const filtered = messages.filter((msg) => {
    if (channel !== 'all' && msg.channel !== channel) return false;
    if (filterBot && msg.role === 'bot' && msg.botName !== filterBot) return false;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      if (!msg.content.toLowerCase().includes(q)) return false;
    }
    return true;
  });

  // Detect user scroll position
  const handleScroll = useCallback(() => {
    const el = containerRef.current;
    if (!el) return;
    const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 60;
    setIsAutoScroll(atBottom);
    if (atBottom) setNewMsgCount(0);
  }, []);

  // Auto-scroll or count new messages
  useEffect(() => {
    const added = messages.length - prevLenRef.current;
    prevLenRef.current = messages.length;

    if (added > 0) {
      if (isAutoScroll) {
        endRef.current?.scrollIntoView({ behavior: 'smooth' });
      } else {
        setNewMsgCount((c) => c + added);
      }
    }
  }, [messages.length, isAutoScroll]);

  const scrollToBottom = useCallback(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
    setNewMsgCount(0);
    setIsAutoScroll(true);
  }, []);

  // Highlight search matches
  const highlightText = useCallback((text: string, query?: string) => {
    if (!query) return text;
    const idx = text.toLowerCase().indexOf(query.toLowerCase());
    if (idx === -1) return text;
    return (
      <>
        {text.slice(0, idx)}
        <mark className="bg-[var(--color-warning)] bg-opacity-30 text-inherit rounded px-0.5">
          {text.slice(idx, idx + query.length)}
        </mark>
        {text.slice(idx + query.length)}
      </>
    );
  }, []);

  if (filtered.length === 0) {
    return (
      <div className="h-full flex items-center justify-center" role="region" aria-label="Chat messages">
        <div className="text-center">
          <div className="text-4xl mb-3 opacity-40" aria-hidden="true">💬</div>
          <p className="text-sm text-[var(--text-secondary)]">
            {searchQuery ? 'No matching messages found.' : 'Start a conversation to begin the workflow.'}
          </p>
          <p className="text-xs text-[var(--text-muted)] mt-1">
            {searchQuery
              ? 'Try a different search query.'
              : 'Describe your project goals and the Orchestrator will guide you through the process.'}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="relative h-full">
      <div
        ref={containerRef}
        onScroll={handleScroll}
        className="h-full overflow-y-auto space-y-3 pr-1"
        role="log"
        aria-label="Chat timeline"
        aria-live="polite"
        aria-relevant="additions"
      >
        {filtered.map((msg) => {
          const config = roleConfig[msg.role] ?? roleConfig.system;
          const isUser = msg.role === 'user';

          return (
            <div
              key={msg.id}
              className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}
              role="article"
              aria-label={`Message from ${msg.botName ?? config.label}`}
            >
              <div
                className={`max-w-[80%] rounded-lg px-3.5 py-2.5 text-sm ${
                  isUser
                    ? 'bg-[var(--color-info)] bg-opacity-15'
                    : 'bg-[var(--bg-elevated)]'
                }`}
                style={{ borderLeft: isUser ? undefined : `3px solid ${config.color}` }}
              >
                <div className="flex items-center gap-2 mb-1">
                  <span
                    className="text-xs font-semibold"
                    style={{ color: config.color }}
                  >
                    {msg.botName ?? config.label}
                  </span>
                  {msg.channel === 'internal' && (
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-[var(--bg-overlay)] text-[var(--text-muted)]" aria-label="Internal channel">
                      internal
                    </span>
                  )}
                  <span className="text-[10px] text-[var(--text-muted)] ml-auto" aria-label="Time">
                    {new Date(msg.timestamp).toLocaleTimeString()}
                  </span>
                </div>
                <div className="text-[var(--text-primary)] whitespace-pre-wrap break-words">
                  {highlightText(msg.content, searchQuery)}
                </div>
              </div>
            </div>
          );
        })}
        <div ref={endRef} />
      </div>

      {/* New messages indicator */}
      {newMsgCount > 0 && (
        <button
          onClick={scrollToBottom}
          className="absolute bottom-2 left-1/2 -translate-x-1/2 px-3 py-1.5 bg-[var(--color-info)] text-white text-xs font-medium rounded-full shadow-lg hover:opacity-90 transition-opacity"
          aria-label={`${newMsgCount} new messages, click to scroll down`}
        >
          {newMsgCount}개 새 메시지 ↓
        </button>
      )}
    </div>
  );
}
