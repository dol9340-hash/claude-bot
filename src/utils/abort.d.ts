/**
 * Creates an AbortController with an optional timeout.
 * Returns cleanup function to clear the timeout.
 */
export declare function createAbortController(timeoutMs?: number): {
    controller: AbortController;
    cleanup: () => void;
};
