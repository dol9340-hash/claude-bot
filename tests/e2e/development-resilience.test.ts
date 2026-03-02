/**
 * E2E: Development resilience regression tests
 * - error_max_turns retry path
 * - development heartbeat lifecycle
 */
import { describe, it, expect, afterEach, vi } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import {
  createTestEnv,
  waitForStep,
  advanceThroughOnboarding,
  approveDecision,
  type TestEnv,
} from '../helpers/test-env.js';

describe('Development Resilience', () => {
  let env: TestEnv;

  afterEach(() => {
    try {
      (env.workflow as unknown as { stopDevelopmentHeartbeat?: () => void }).stopDevelopmentHeartbeat?.();
    } catch {
      // Ignore cleanup errors from private helper access in tests.
    }
    env?.cleanup();
    vi.useRealTimers();
  });

  it('should retry once when developer hits error_max_turns', async () => {
    env = createTestEnv({
      delayMs: 10,
      success: true,
      failOnCalls: [0],
      failResultText: 'Task failed: error_max_turns',
      failErrors: ['subtype=error_max_turns'],
      progressMessages: ['progress ping'],
      costPerTask: 0.03,
    });

    await advanceThroughOnboarding(env.workflow, env.chat, 'Retry regression');
    approveDecision(env.workflow, env.chat, 'prediction');
    await waitForStep(env.chat, 'documentation', 2000);
    approveDecision(env.workflow, env.chat, 'documentation');
    await waitForStep(env.chat, 'development', 2000);
    approveDecision(env.workflow, env.chat, 'proposal');
    await waitForStep(env.chat, 'review', 10000);

    // baseline was 2 calls (developer + reviewer). Retry should add +1.
    expect(env.executor.getCallCount()).toBeGreaterThanOrEqual(3);

    const internal = env.chat.getMessages('internal').map((m) => m.content);
    expect(internal.some((m) => m.includes('error_max_turns 감지'))).toBe(true);
    expect(internal.some((m) => m.includes('(재시도) progress ping'))).toBe(true);
    expect(internal.some((m) => m.includes('[재시도 성공]'))).toBe(true);
  });

  it('should not retry when retryOnMaxTurns is disabled', async () => {
    env = createTestEnv({
      delayMs: 10,
      success: true,
      failOnCalls: [0],
      failResultText: 'Task failed: error_max_turns',
      failErrors: ['subtype=error_max_turns'],
      costPerTask: 0.03,
    });

    env.composer.setBaseConfig({
      cwd: process.cwd(),
      permissionMode: 'acceptEdits',
      taskTimeoutMs: 60_000,
      logLevel: 'info',
      maxTurnsPerTask: 24,
      retryOnMaxTurns: false,
    });

    await advanceThroughOnboarding(env.workflow, env.chat, 'Retry disabled');
    approveDecision(env.workflow, env.chat, 'prediction');
    await waitForStep(env.chat, 'documentation', 2000);
    approveDecision(env.workflow, env.chat, 'documentation');
    await waitForStep(env.chat, 'development', 2000);
    approveDecision(env.workflow, env.chat, 'proposal');
    await waitForStep(env.chat, 'review', 10000);

    // No retry => developer fail + reviewer run
    expect(env.executor.getCallCount()).toBe(2);
    const internal = env.chat.getMessages('internal').map((m) => m.content);
    expect(internal.some((m) => m.includes('error_max_turns 감지'))).toBe(false);

    const failedRecord = env.sessions.getRecords().find((r) => !r.success && r.botName === 'developer');
    expect(failedRecord).toBeDefined();
    expect(failedRecord?.errorCode).toBe('error_max_turns');
    expect(failedRecord?.failureReason).toContain('Task failed');

    const reviewCard = env.chat.getWorkflow().decisions.find((d) => d.status === 'pending' && d.type === 'review');
    expect(reviewCard).toBeDefined();
    expect(reviewCard?.description).toContain('주요 실패 원인');
    expect(reviewCard?.tabs?.[0]?.html).toContain('Failure Reasons');
    expect(reviewCard?.tabs?.[0]?.html).toContain('error_max_turns');
  });

  it('should transition to review quickly after stop command', async () => {
    env = createTestEnv({
      delayMs: 30_000,
      success: true,
      costPerTask: 0.02,
    });

    await advanceThroughOnboarding(env.workflow, env.chat, 'Stop handling');
    approveDecision(env.workflow, env.chat, 'prediction');
    await waitForStep(env.chat, 'documentation', 2000);
    approveDecision(env.workflow, env.chat, 'documentation');
    await waitForStep(env.chat, 'development', 2000);
    approveDecision(env.workflow, env.chat, 'proposal');

    await new Promise((r) => setTimeout(r, 50));
    env.workflow.handleUserMessage('중단');

    await waitForStep(env.chat, 'review', 3000);
    expect(env.executor.getCallCount()).toBe(1);

    const main = env.chat.getMessages('main').map((m) => m.content);
    expect(main.some((m) => m.includes('사용자 요청에 의해 개발이 중단되었습니다.'))).toBe(true);
  });

  it('should emit heartbeat during development and stop after step changes', async () => {
    env = createTestEnv({ delayMs: 10, success: true, costPerTask: 0.02 });
    vi.useFakeTimers();

    const workflow = env.workflow as unknown as {
      devStartedAt: string | null;
      startDevelopmentHeartbeat: () => void;
      stopDevelopmentHeartbeat: () => void;
    };

    env.chat.setStep('development');
    env.chat.setActiveBots(['developer', 'reviewer']);
    workflow.devStartedAt = new Date(Date.now() - 90_000).toISOString();
    workflow.startDevelopmentHeartbeat();

    await vi.advanceTimersByTimeAsync(45_000);

    const main1 = env.chat.getMessages('main').filter(
      (m) => m.role === 'orchestrator' && m.content.includes('개발 진행 중입니다.'),
    );
    expect(main1.length).toBeGreaterThanOrEqual(1);

    env.chat.setStep('review');
    await vi.advanceTimersByTimeAsync(50_000);

    const main2 = env.chat.getMessages('main').filter(
      (m) => m.role === 'orchestrator' && m.content.includes('개발 진행 중입니다.'),
    );
    expect(main2.length).toBe(main1.length);

    workflow.stopDevelopmentHeartbeat();
  });

  it('should respect configured heartbeat interval from claudebot.config.json', async () => {
    env = createTestEnv({ delayMs: 10, success: true, costPerTask: 0.02 });
    vi.useFakeTimers();

    const configPath = path.join(env.projectPath, 'claudebot.config.json');
    fs.writeFileSync(configPath, JSON.stringify({ developmentHeartbeatIntervalMs: 1000 }), 'utf-8');

    const workflow = env.workflow as unknown as {
      devStartedAt: string | null;
      startDevelopmentHeartbeat: () => void;
      stopDevelopmentHeartbeat: () => void;
    };

    env.chat.setStep('development');
    workflow.devStartedAt = new Date(Date.now() - 5_000).toISOString();
    workflow.startDevelopmentHeartbeat();

    await vi.advanceTimersByTimeAsync(1_100);

    const main = env.chat.getMessages('main').filter(
      (m) => m.role === 'orchestrator' && m.content.includes('개발 진행 중입니다.'),
    );
    expect(main.length).toBeGreaterThanOrEqual(1);

    workflow.stopDevelopmentHeartbeat();
  });
});
