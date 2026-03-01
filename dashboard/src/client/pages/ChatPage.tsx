import { useState, useCallback } from 'react';
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
          // Avoid duplicates
          if (prev.some((m) => m.id === msg.message.id)) return prev;
          return [...prev, msg.message];
        });
        break;
      case 'workflow':
        setWorkflow(msg.state);
        break;
      case 'bots':
        setBots(msg.bots);
        break;
      case 'decision':
        setPendingDecisions((prev) => {
          const idx = prev.findIndex((d) => d.id === msg.card.id);
          if (msg.card.status !== 'pending') {
            // Resolved — remove from pending
            return prev.filter((d) => d.id !== msg.card.id);
          }
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

  const handleSend = useCallback(
    (content: string) => {
      send({ type: 'chat', content });
    },
    [send],
  );

  const handleDecision = useCallback(
    (decisionId: string, status: 'approved' | 'rejected' | 'modified', response?: string) => {
      send({ type: 'decision', decisionId, status, response });
    },
    [send],
  );

  return (
    <div className="h-full flex flex-col">
      {/* Workflow progress bar */}
      <WorkflowBar workflow={workflow} connected={connected} />

      <div className="flex-1 flex gap-4 min-h-0 mt-4">
        {/* Main chat area */}
        <div className="flex-1 flex flex-col min-w-0">
          {/* Pending decisions */}
          {pendingDecisions.length > 0 && (
            <div className="space-y-2 mb-3">
              {pendingDecisions.map((card) => (
                <DecisionCard key={card.id} card={card} onResolve={handleDecision} />
              ))}
            </div>
          )}

          {/* Messages */}
          <div className="flex-1 min-h-0">
            <ChatTimeline messages={messages} />
          </div>

          {/* Input */}
          <ChatInput onSend={handleSend} disabled={!connected} />
        </div>

        {/* Bot status sidebar */}
        {bots.length > 0 && (
          <div className="w-64 shrink-0">
            <BotStatusPanel bots={bots} />
          </div>
        )}
      </div>
    </div>
  );
}
