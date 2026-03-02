import { useEffect, useRef, useState, useCallback } from 'react';
import type { WSClientMessage, WSServerMessage } from '@shared/api-types';

interface UseWebSocketOptions {
  onMessage?: (msg: WSServerMessage) => void;
}

export function useWebSocket({ onMessage }: UseWebSocketOptions = {}) {
  const [connected, setConnected] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);
  const onMessageRef = useRef(onMessage);
  onMessageRef.current = onMessage;

  useEffect(() => {
    let ws: WebSocket | null = null;
    let retryCount = 0;
    let retryTimer: ReturnType<typeof setTimeout>;
    let disposed = false;

    function connect() {
      if (disposed) return;

      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const url = `${protocol}//${window.location.host}/api/chat/ws`;
      ws = new WebSocket(url);
      wsRef.current = ws;

      ws.onopen = () => {
        setConnected(true);
        retryCount = 0;
      };

      ws.onmessage = (ev) => {
        try {
          const msg = JSON.parse(ev.data) as WSServerMessage;
          onMessageRef.current?.(msg);
        } catch { /* ignore malformed messages */ }
      };

      ws.onclose = () => {
        setConnected(false);
        wsRef.current = null;
        if (!disposed) {
          const delay = Math.min(1000 * 2 ** retryCount, 30_000);
          retryCount++;
          retryTimer = setTimeout(connect, delay);
        }
      };

      ws.onerror = () => {
        // onclose will handle retries; avoid force-closing CONNECTING sockets.
      };
    }

    connect();

    return () => {
      disposed = true;
      clearTimeout(retryTimer);
      if (ws?.readyState === WebSocket.OPEN) {
        ws.close();
      }
      wsRef.current = null;
    };
  }, []);

  const send = useCallback((msg: WSClientMessage): boolean => {
    const ws = wsRef.current;
    if (!ws || ws.readyState !== WebSocket.OPEN) {
      return false;
    }

    try {
      ws.send(JSON.stringify(msg));
      return true;
    } catch {
      return false;
    }
  }, []);

  return { connected, send };
}
