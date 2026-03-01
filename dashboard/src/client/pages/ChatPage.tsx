import { useState, useCallback, useEffect } from 'react';
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
import WorkflowBar from '../components/chat/WorkflowBar';
import BotStatusPanel from '../components/chat/BotStatusPanel';
import DecisionCard from '../components/chat/DecisionCard';

export default function ChatPage() {
  const [messages, setMessages] = useState<ChatMessageDTO[]>([]);
  const [workflow, setWorkflow] = useState<WorkflowStateDTO | null>(null);
  const [bots, setBots] = useState<BotStatusDTO[]>([]);
  const [pendingDecisions, setPendingDecisions] = useState<DecisionCardDTO[]>([]);

  const handleMessage = useCallback((msg: WSServerMessage) => {
    switch (msg.type) {
      case 'chat':
        setMessages((prev) => {
          if (prev.some((m) => m.id === msg.message.id)) return prev;
          return [...prev, msg.message];
        });
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
        break;
    }
  }, []);

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

  // Send message — optimistic update FIRST, then WS/REST
  const handleSend = useCallback(
    async (content: string) => {
      // 1) Optimistic: show user's message immediately
      const tempId = Math.random().toString(36).slice(2, 10);
      setMessages((prev) => [
        ...prev,
        { id: tempId, role: 'user', content, channel: 'main', timestamp: new Date().toISOString() },
      ]);

      // 2) Send to server
      if (connected) {
        send({ type: 'chat', content });
      } else {
        try {
          await fetch('/api/chat/send', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ content }),
          });
          await refreshFromRest();
        } catch { /* swallow */ }
      }
    },
    [connected, send, refreshFromRest],
  );

  // Resolve decision — WS primary, REST fallback
  const handleDecision = useCallback(
    async (decisionId: string, status: 'approved' | 'rejected' | 'modified', response?: string) => {
      if (connected) {
        send({ type: 'decision', decisionId, status, response });
      } else {
        try {
          await fetch('/api/chat/decision', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ decisionId, status, response }),
          });
          await refreshFromRest();
        } catch { /* swallow */ }
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
    } catch { /* swallow */ }
  }, []);

  return (
    <div className="h-full flex flex-col">
      <WorkflowBar workflow={workflow} connected={connected} onReset={handleReset} />

      <div className="flex-1 flex gap-4 min-h-0 mt-4">
        <div className="flex-1 flex flex-col min-w-0">
          {/* Pending decisions */}
          {pendingDecisions.length > 0 && (
            <div className="space-y-2 mb-3">
              {pendingDecisions.map((card) => (
                <DecisionCard key={card.id} card={card} onResolve={handleDecision} />
              ))}
            </div>
          )}

          {/* Messages timeline */}
          <div className="flex-1 min-h-0">
            <ChatTimeline messages={messages} />
          </div>

          {/* Input — always enabled */}
          <ChatInput onSend={handleSend} />
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
