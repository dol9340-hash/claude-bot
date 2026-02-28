import { useEffect, useState, useRef, useCallback } from 'react';
import type { SSEEventType } from '@shared/api-types';

interface UseSSEOptions {
  onEvent?: (eventType: SSEEventType) => void;
}

export function useSSE({ onEvent }: UseSSEOptions = {}) {
  const [connected, setConnected] = useState(false);
  const onEventRef = useRef(onEvent);
  onEventRef.current = onEvent;

  useEffect(() => {
    let es: EventSource | null = null;
    let retryCount = 0;
    let retryTimer: ReturnType<typeof setTimeout>;

    function connect() {
      es = new EventSource('/api/events');

      const eventTypes: SSEEventType[] = [
        'connected',
        'sessions_updated',
        'tasks_updated',
        'config_updated',
        'heartbeat',
      ];

      for (const type of eventTypes) {
        es.addEventListener(type, () => {
          if (type === 'connected') {
            setConnected(true);
            retryCount = 0;
          }
          onEventRef.current?.(type);
        });
      }

      es.onerror = () => {
        setConnected(false);
        es?.close();
        // Exponential backoff: 1s, 2s, 4s, 8s, max 30s
        const delay = Math.min(1000 * 2 ** retryCount, 30_000);
        retryCount++;
        retryTimer = setTimeout(connect, delay);
      };
    }

    connect();

    return () => {
      es?.close();
      clearTimeout(retryTimer);
    };
  }, []);

  return { connected };
}
