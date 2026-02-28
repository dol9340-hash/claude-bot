/**
 * Creates an AbortController with an optional timeout.
 * Returns cleanup function to clear the timeout.
 */
export function createAbortController(timeoutMs?: number): {
  controller: AbortController;
  cleanup: () => void;
} {
  const controller = new AbortController();

  if (timeoutMs === undefined) {
    return { controller, cleanup: () => {} };
  }

  const timer = setTimeout(() => {
    controller.abort(new Error(`Task timed out after ${timeoutMs}ms`));
  }, timeoutMs);

  const cleanup = () => clearTimeout(timer);

  return { controller, cleanup };
}
