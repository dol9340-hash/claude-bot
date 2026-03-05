import type { TaskResult } from '../types.js';
import type { IExecutor, ExecuteOptions } from './types.js';
/**
 * SDK Executor — runs prompts via the Claude Agent SDK.
 * Supports optional retry via executeWithRetry().
 */
export declare class SdkExecutor implements IExecutor {
    private maxRetries;
    setMaxRetries(n: number): void;
    /**
     * Execute with automatic retry on transient errors.
     */
    executeWithRetry(options: ExecuteOptions): Promise<TaskResult>;
    execute(options: ExecuteOptions): Promise<TaskResult>;
}
