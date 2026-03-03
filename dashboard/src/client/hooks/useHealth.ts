import { useCallback, useEffect, useRef, useState } from 'react';
import type { HealthResponse } from '@shared/api-types';

interface UseHealthResult {
  health: HealthResponse | null;
  error: string | null;
  loading: boolean;
  refetch: () => void;
}

const POLL_INTERVAL_MS = 15_000;

export function useHealth(): UseHealthResult {
  const [health, setHealth] = useState<HealthResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const abortRef = useRef<AbortController | null>(null);

  const fetchHealth = useCallback(() => {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setLoading(true);
    setError(null);

    fetch('/api/health', { signal: controller.signal })
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json() as Promise<HealthResponse>;
      })
      .then((payload) => {
        setHealth(payload);
        setError(null);
      })
      .catch((err: Error) => {
        if (err.name === 'AbortError') return;
        setError(err.message);
      })
      .finally(() => {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      });
  }, []);

  useEffect(() => {
    fetchHealth();
    const timer = setInterval(fetchHealth, POLL_INTERVAL_MS);
    return () => {
      clearInterval(timer);
      abortRef.current?.abort();
    };
  }, [fetchHealth]);

  return {
    health,
    error,
    loading,
    refetch: fetchHealth,
  };
}
