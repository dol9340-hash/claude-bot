import { useState, useCallback, useRef, type KeyboardEvent } from 'react';

interface ChatInputProps {
  onSend: (content: string) => void;
  disabled?: boolean;
  activeBots?: string[];
}

export default function ChatInput({ onSend, disabled, activeBots }: ChatInputProps) {
  const [value, setValue] = useState('');
  const [showMentions, setShowMentions] = useState(false);
  const [mentionFilter, setMentionFilter] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const handleSend = useCallback(() => {
    const trimmed = value.trim();
    if (!trimmed) return;
    onSend(trimmed);
    setValue('');
    setShowMentions(false);
  }, [value, onSend]);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        handleSend();
      }
      if (e.key === 'Escape') {
        setShowMentions(false);
      }
    },
    [handleSend],
  );

  const handleChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value;
    setValue(val);

    // Detect @mention trigger
    const cursorPos = e.target.selectionStart;
    const textBefore = val.substring(0, cursorPos);
    const mentionMatch = textBefore.match(/@(\w*)$/);

    if (mentionMatch && activeBots && activeBots.length > 0) {
      setShowMentions(true);
      setMentionFilter(mentionMatch[1].toLowerCase());
    } else {
      setShowMentions(false);
    }
  }, [activeBots]);

  const insertMention = useCallback((botName: string) => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    const cursorPos = textarea.selectionStart;
    const textBefore = value.substring(0, cursorPos);
    const textAfter = value.substring(cursorPos);
    const mentionStart = textBefore.lastIndexOf('@');

    if (mentionStart >= 0) {
      const newValue = textBefore.substring(0, mentionStart) + `@${botName} ` + textAfter;
      setValue(newValue);
    }

    setShowMentions(false);
    textarea.focus();
  }, [value]);

  const filteredBots = (activeBots ?? []).filter(
    (b) => !mentionFilter || b.toLowerCase().includes(mentionFilter),
  );

  return (
    <div className="mt-3 relative">
      {/* @mention dropdown */}
      {showMentions && filteredBots.length > 0 && (
        <div
          className="absolute bottom-full left-0 mb-1 bg-[var(--bg-surface)] border border-[var(--border-default)] rounded-lg shadow-lg py-1 min-w-[140px] z-10"
          role="listbox"
          aria-label="Mention a bot"
        >
          {filteredBots.map((bot) => (
            <button
              key={bot}
              onClick={() => insertMention(bot)}
              className="w-full text-left px-3 py-1.5 text-xs text-[var(--text-primary)] hover:bg-[var(--bg-elevated)] transition-colors"
              role="option"
            >
              @{bot}
            </button>
          ))}
        </div>
      )}

      <div className="flex gap-2">
        <textarea
          ref={textareaRef}
          value={value}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          placeholder={disabled ? 'Connecting...' : 'Describe your project goals... (Use @bot to mention)'}
          disabled={disabled}
          rows={2}
          className="flex-1 bg-[var(--bg-elevated)] border border-[var(--border-default)] rounded-lg px-3 py-2 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)] resize-none outline-none focus:border-[var(--color-info)] transition-colors disabled:opacity-50"
          aria-label="Chat message input"
          aria-describedby="chat-input-hint"
        />
        <button
          onClick={handleSend}
          disabled={disabled || !value.trim()}
          className="px-4 py-2 bg-[var(--color-info)] text-white text-sm font-medium rounded-lg hover:opacity-90 transition-opacity disabled:opacity-40 disabled:cursor-not-allowed self-end"
          aria-label="Send message"
        >
          Send
        </button>
      </div>
      <p id="chat-input-hint" className="sr-only">Press Enter to send, Shift+Enter for new line. Type @ to mention a bot.</p>
    </div>
  );
}
