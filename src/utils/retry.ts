import type { Logger } from 'pino';

export interface RetryOptions {
  maxRetries: number;
  baseDelayMs?: number;
  maxDelayMs?: number;
  logger: Logger;
}

/**
 * Exponential backoff retry wrapper.
 * Calls `fn` up to `maxRetries + 1` times.
 * Uses `shouldRetry` to decide whether to retry based on result or error.
 */
export async function withRetry<T>(
  fn: (attempt: number) => Promise<T>,
  shouldRetry: (error: unknown, result: T | undefined) => boolean,
  opts: RetryOptions,
): Promise<T> {
  const { maxRetries, baseDelayMs = 1000, maxDelayMs = 30000, logger } = opts;
  let lastError: unknown;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const result = await fn(attempt);

      if (!shouldRetry(undefined, result)) {
        return result;
      }

      if (attempt < maxRetries) {
        const delay = Math.min(baseDelayMs * Math.pow(2, attempt), maxDelayMs);
        logger.warn({ attempt, delay }, 'Result indicates retry needed, backing off');
        await sleep(delay);
      }
    } catch (error) {
      lastError = error;
      if (attempt < maxRetries) {
        const delay = Math.min(baseDelayMs * Math.pow(2, attempt), maxDelayMs);
        logger.warn({ attempt, delay, error }, 'Task threw error, retrying');
        await sleep(delay);
      }
    }
  }

  throw lastError ?? new Error('Retry exhausted without result');
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}
