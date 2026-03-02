import { useState, useCallback, useEffect, useRef } from 'react';
import type {
  ChatMessageDTO,
  WorkflowStateDTO,
  DecisionCardDTO,
  BotStatusDTO,
  WSServerMessage,
} from '@shared/api-types';
import { useWebSocket } from '../hooks/useWebSocket';
import ChatTimeline from '../components/chat/ChatTimeline';
import ChatInput from '../components/chat/ChatInput';
import ChatSearchBar from '../components/chat/ChatSearchBar';
import WorkflowBar from '../components/chat/WorkflowBar';
import BotStatusPanel from '../components/chat/BotStatusPanel';
import DecisionCard from '../components/chat/DecisionCard';
import NotificationToast, { type Notification } from '../components/chat/NotificationToast';

type ChannelTab = 'all' | 'main' | 'internal';

export default function ChatPage() {
  const [messages, setMessages] = useState<ChatMessageDTO[]>([]);
  const [workflow, setWorkflow] = useState<WorkflowStateDTO | null>(null);
  const [bots, setBots] = useState<BotStatusDTO[]>([]);
  const [pendingDecisions, setPendingDecisions] = useState<DecisionCardDTO[]>([]);

  // Phase 5.3: Channel tabs
  const [activeChannel, setActiveChannel] = useState<ChannelTab>('all');

  // Phase 5.4: Search and filter
  const [searchQuery, setSearchQuery] = useState('');
  const [filterBot, setFilterBot] = useState('');

  // Phase 5.6: Notification system
  const [notifications, setNotifications] = useState<Notification[]>([]);

  // Phase 5.3: Tab notification counter
  const [unreadCount, setUnreadCount] = useState(0);
  const isVisibleRef = useRef(true);
  const originalTitleRef = useRef(document.title);

  // Track document visibility for tab notifications
  useEffect(() => {
    const handleVisibility = () => {
      isVisibleRef.current = !document.hidden;
      if (!document.hidden) {
        setUnreadCount(0);
        document.title = originalTitleRef.current;
      }
    };
    document.addEventListener('visibilitychange', handleVisibility);
    return () => document.removeEventListener('visibilitychange', handleVisibility);
  }, []);

  // Update tab title when unread count changes
  useEffect(() => {
    if (unreadCount > 0) {
      document.title = `(${unreadCount}) ${originalTitleRef.current}`;
    }
  }, [unreadCount]);

  const addNotification = useCallback((level: Notification['level'], title: string, message: string) => {
    const n: Notification = {
      id: Math.random().toString(36).slice(2),
      level,
      title,
      message,
      timestamp: new Date().toISOString(),
      autoDismissMs: level === 'critical' ? undefined : level === 'important' ? 8000 : 4000,
    };
    setNotifications((prev) => [...prev, n]);
  }, []);

  const dismissNotification = useCallback((id: string) => {
    setNotifications((prev) => prev.filter((n) => n.id !== id));
  }, []);

  const handleMessage = useCallback((msg: WSServerMessage) => {
    switch (msg.type) {
      case 'chat':
        setMessages((prev) => {
          if (prev.some((m) => m.id === msg.message.id)) return prev;
          return [...prev, msg.message];
        });
        // Tab notification for non-visible tab
        if (!isVisibleRef.current) {
          setUnreadCount((c) => c + 1);
        }
        break;
      case 'workflow':
        setWorkflow(msg.state);
        if (msg.state.decisions) {
          setPendingDecisions(msg.state.decisions.filter((d) => d.status === 'pending'));
        }
        break;
      case 'bots':
        setBots(msg.bots);
        break;
      case 'decision':
        setPendingDecisions((prev) => {
          if (msg.card.status !== 'pending') {
            return prev.filter((d) => d.id !== msg.card.id);
          }
          const idx = prev.findIndex((d) => d.id === msg.card.id);
          if (idx >= 0) {
            const updated = [...prev];
            updated[idx] = msg.card;
            return updated;
          }
          return [...prev, msg.card];
        });
        // Notification for new decisions
        if (msg.card.status === 'pending') {
          addNotification('important', 'Decision Required', msg.card.title);
        }
        break;
      case 'error':
        addNotification('critical', 'Error', msg.message);
        break;
    }
  }, [addNotification]);

  const { connected, send } = useWebSocket({ onMessage: handleMessage });

  // Refresh full state from REST
  const refreshFromRest = useCallback(async () => {
    try {
      await new Promise((r) => setTimeout(r, 600));
      const [msgRes, wfRes] = await Promise.all([
        fetch('/api/chat/messages'),
        fetch('/api/chat/workflow'),
      ]);
      if (msgRes.ok) setMessages(await msgRes.json());
      if (wfRes.ok) {
        const wf: WorkflowStateDTO = await wfRes.json();
        setWorkflow(wf);
        setPendingDecisions(wf.decisions?.filter((d) => d.status === 'pending') ?? []);
      }
    } catch { /* swallow */ }
  }, []);

  // Send message — WS first, REST fallback for reliability
  const handleSend = useCallback(
    async (content: string) => {
      const sentViaWs = connected && send({ type: 'chat', content });
      if (sentViaWs) return;

      try {
        await fetch('/api/chat/send', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ content }),
        });
        await refreshFromRest();
      } catch {
        // swallow
      }
    },
    [connected, send, refreshFromRest],
  );

  // Resolve decision — WS first, REST fallback for reliability
  const handleDecision = useCallback(
    async (decisionId: string, status: 'approved' | 'rejected' | 'modified', response?: string) => {
      const sentViaWs = connected && send({ type: 'decision', decisionId, status, response });
      if (sentViaWs) return;

      try {
        await fetch('/api/chat/decision', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ decisionId, status, response }),
        });
        await refreshFromRest();
      } catch {
        // swallow
      }
    },
    [connected, send, refreshFromRest],
  );

  // Load initial data on mount via REST
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [msgRes, wfRes, decRes] = await Promise.all([
          fetch('/api/chat/messages'),
          fetch('/api/chat/workflow'),
          fetch('/api/chat/decisions'),
        ]);
        if (cancelled) return;
        if (msgRes.ok) setMessages(await msgRes.json());
        if (wfRes.ok) {
          const wf: WorkflowStateDTO = await wfRes.json();
          setWorkflow(wf);
          if (wf.decisions) {
            setPendingDecisions(wf.decisions.filter((d) => d.status === 'pending'));
          }
        }
        if (decRes.ok) {
          const decs: DecisionCardDTO[] = await decRes.json();
          if (decs.length > 0) setPendingDecisions(decs);
        }
      } catch { /* WS will deliver */ }
    })();
    return () => { cancelled = true; };
  }, []);

  // Reset workflow
  const handleReset = useCallback(async () => {
    try {
      await fetch('/api/chat/reset', { method: 'POST' });
      setMessages([]);
      setWorkflow(null);
      setPendingDecisions([]);
      setBots([]);
      setSearchQuery('');
      setFilterBot('');
      setActiveChannel('all');
    } catch { /* swallow */ }
  }, []);

  // Toggle auto-pilot
  const handleToggleAutoPilot = useCallback(async (enabled: boolean) => {
    try {
      await fetch('/api/chat/autopilot', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled }),
      });
      setWorkflow((prev) => prev ? { ...prev, autoOnboarding: enabled } : prev);
    } catch { /* swallow */ }
  }, []);

  // Keyboard shortcut: Ctrl+K for search focus
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        const searchInput = document.querySelector('[aria-label="Search messages"]') as HTMLInputElement | null;
        searchInput?.focus();
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, []);

  const activeBotNames = bots.map((b) => b.name);
  const channelTabs: { key: ChannelTab; label: string; count?: number }[] = [
    { key: 'all', label: 'All' },
    { key: 'main', label: 'Main', count: messages.filter((m) => m.channel === 'main').length },
    { key: 'internal', label: 'Internal', count: messages.filter((m) => m.channel === 'internal').length },
  ];

  return (
    <div className="h-full flex flex-col" role="main" aria-label="Chat workspace">
      {/* Notifications */}
      <NotificationToast notifications={notifications} onDismiss={dismissNotification} />

      <WorkflowBar workflow={workflow} connected={connected} onReset={handleReset} onToggleAutoPilot={handleToggleAutoPilot} />

      <div className="flex-1 flex gap-4 min-h-0 mt-4">
        <div className="flex-1 flex flex-col min-w-0">
          {/* Channel tabs */}
          <div className="flex items-center gap-1 mb-2" role="tablist" aria-label="Message channels">
            {channelTabs.map((tab) => (
              <button
                key={tab.key}
                role="tab"
                aria-selected={activeChannel === tab.key}
                onClick={() => setActiveChannel(tab.key)}
                className={`px-3 py-1 text-xs font-medium rounded transition-colors ${
                  activeChannel === tab.key
                    ? 'bg-[var(--color-info)] text-white'
                    : 'bg-[var(--bg-overlay)] text-[var(--text-muted)] hover:text-[var(--text-secondary)]'
                }`}
              >
                {tab.label}
                {tab.key !== 'all' && tab.count !== undefined && tab.count > 0 && (
                  <span className="ml-1.5 text-[10px] opacity-75">({tab.count})</span>
                )}
              </button>
            ))}
          </div>

          {/* Search bar */}
          <ChatSearchBar
            onSearch={setSearchQuery}
            onFilterBot={setFilterBot}
            activeBots={activeBotNames}
          />

          {/* Pending decisions */}
          {pendingDecisions.length > 0 && (
            <div className="space-y-2 mb-3" role="region" aria-label="Pending decisions">
              {pendingDecisions.map((card) => (
                <DecisionCard key={card.id} card={card} onResolve={handleDecision} />
              ))}
            </div>
          )}

          {/* Messages timeline */}
          <div className="flex-1 min-h-0" role="tabpanel" aria-label={`${activeChannel} messages`}>
            <ChatTimeline
              messages={messages}
              channel={activeChannel}
              searchQuery={searchQuery}
              filterBot={filterBot}
            />
          </div>

          {/* Input — always enabled */}
          <ChatInput onSend={handleSend} activeBots={activeBotNames} />
        </div>

        {bots.length > 0 && (
          <div className="w-64 shrink-0">
            <BotStatusPanel bots={bots} />
          </div>
        )}
      </div>
    </div>
  );
}
