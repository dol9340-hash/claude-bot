import { useEffect, useRef } from 'react';
import type { ChatMessageDTO } from '@shared/api-types';

interface ChatTimelineProps {
  messages: ChatMessageDTO[];
}

const roleConfig: Record<string, { color: string; label: string }> = {
  user: { color: 'var(--color-info)', label: 'You' },
  orchestrator: { color: 'var(--color-sdk)', label: 'Orchestrator' },
  bot: { color: 'var(--color-cli)', label: 'Bot' },
  system: { color: 'var(--text-muted)', label: 'System' },
};

export default function ChatTimeline({ messages }: ChatTimelineProps) {
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length]);

  if (messages.length === 0) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="text-center">
          <div className="text-4xl mb-3 opacity-40">💬</div>
          <p className="text-sm text-[var(--text-secondary)]">
            Start a conversation to begin the workflow.
          </p>
          <p className="text-xs text-[var(--text-muted)] mt-1">
            Describe your project goals and the Orchestrator will guide you through the process.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full overflow-y-auto space-y-3 pr-1">
      {messages.map((msg) => {
        const config = roleConfig[msg.role] ?? roleConfig.system;
        const isUser = msg.role === 'user';

        return (
          <div
            key={msg.id}
            className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}
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
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-[var(--bg-overlay)] text-[var(--text-muted)]">
                    internal
                  </span>
                )}
                <span className="text-[10px] text-[var(--text-muted)] ml-auto">
                  {new Date(msg.timestamp).toLocaleTimeString()}
                </span>
              </div>
              <div className="text-[var(--text-primary)] whitespace-pre-wrap break-words">
                {msg.content}
              </div>
            </div>
          </div>
        );
      })}
      <div ref={endRef} />
    </div>
  );
}
