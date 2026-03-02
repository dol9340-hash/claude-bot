/**
 * E2E: Real SDK Integration Test (flag-gated)
 *
 * Run with: CLAUDEBOT_TEST_SDK=1 npm test
 *
 * Requires:
 * - ANTHROPIC_API_KEY environment variable
 * - Real API call (incurs cost)
 */
import { describe, it, expect } from 'vitest';
import { SdkExecutor } from '../../src/engine/sdk-executor.js';
import type { ClaudeBotConfig } from '../../src/types.js';

const SDK_ENABLED = process.env.CLAUDEBOT_TEST_SDK === '1';

describe.skipIf(!SDK_ENABLED)('Real SDK Integration', () => {
  it('should execute a simple prompt via SdkExecutor', async () => {
    const executor = new SdkExecutor();

    const config: ClaudeBotConfig = {
      cwd: process.cwd(),
      permissionMode: 'default',
      taskTimeoutMs: 30_000,
      logLevel: 'info',
      model: 'claude-sonnet-4-6',
      maxBudgetPerTaskUsd: 0.10,
      maxTurnsPerTask: 3,
    };

    const result = await executor.execute({
      prompt: 'What is 2 + 2? Reply with just the number.',
      config,
    });

    expect(result.success).toBe(true);
    expect(result.result).toContain('4');
    expect(result.costUsd).toBeGreaterThan(0);
    expect(result.sessionId).toBeTruthy();
  }, 60_000);

  it('should support executeWithRetry', async () => {
    const executor = new SdkExecutor();
    executor.setMaxRetries(1);

    const config: ClaudeBotConfig = {
      cwd: process.cwd(),
      permissionMode: 'default',
      taskTimeoutMs: 30_000,
      logLevel: 'info',
      model: 'claude-sonnet-4-6',
      maxBudgetPerTaskUsd: 0.10,
      maxTurnsPerTask: 3,
    };

    const result = await executor.executeWithRetry({
      prompt: 'Reply with the word "hello".',
      config,
    });

    expect(result.success).toBe(true);
    expect(result.result.toLowerCase()).toContain('hello');
  }, 60_000);
});
