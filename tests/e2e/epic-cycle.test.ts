/**
 * E2E: Epic Cycle 연속 2회 실행 테스트
 * 첫 번째 Epic 완료 → 다음 Epic 제안 → 두 번째 Epic 실행
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  createTestEnv,
  waitForStep,
  advanceThroughOnboarding,
  approveDecision,
  type TestEnv,
} from '../helpers/test-env.js';

async function runFullCycle(env: TestEnv, topic: string): Promise<void> {
  await advanceThroughOnboarding(env.workflow, env.chat, topic);
  approveDecision(env.workflow, env.chat, 'prediction');
  await waitForStep(env.chat, 'documentation', 2000);
  approveDecision(env.workflow, env.chat, 'documentation');
  await waitForStep(env.chat, 'development', 2000);
  approveDecision(env.workflow, env.chat, 'proposal');
  await waitForStep(env.chat, 'review', 10000);
  approveDecision(env.workflow, env.chat, 'review');
  await waitForStep(env.chat, 'completed', 2000);
}

describe('Epic Cycle — 2 consecutive runs', () => {
  let env: TestEnv;

  beforeEach(() => {
    env = createTestEnv({ delayMs: 10, success: true, costPerTask: 0.02 });
  });

  afterEach(() => {
    env.cleanup();
  });

  it('should complete first Epic and suggest next', async () => {
    await runFullCycle(env, 'Epic 1: Build auth');

    const workflow = env.chat.getWorkflow();
    expect(workflow.epicNumber).toBe(1);
    expect(workflow.epics.length).toBe(1);
    expect(workflow.step).toBe('completed');
  });

  it('should start second Epic from completed state', async () => {
    await runFullCycle(env, 'Epic 1: Build auth');

    // Start second epic by typing a new topic in completed state
    env.workflow.handleUserMessage('Epic 2: Add dashboard');
    await waitForStep(env.chat, 'onboarding', 2000);

    expect(env.chat.getWorkflow().topic).toBe('Epic 2: Add dashboard');
    expect(env.chat.getWorkflow().epicNumber).toBe(1); // Preserved from first epic
  });

  it('should run two full Epic cycles', async () => {
    // First Epic
    await runFullCycle(env, 'Epic 1: Setup project');
    expect(env.chat.getWorkflow().epics.length).toBe(1);

    // Start second epic
    env.workflow.handleUserMessage('Epic 2: Add features');
    await waitForStep(env.chat, 'onboarding', 2000);

    // Run second Epic
    env.workflow.handleUserMessage('다음');
    await waitForStep(env.chat, 'prediction', 2000);
    approveDecision(env.workflow, env.chat, 'prediction');
    await waitForStep(env.chat, 'documentation', 2000);
    approveDecision(env.workflow, env.chat, 'documentation');
    await waitForStep(env.chat, 'development', 2000);
    approveDecision(env.workflow, env.chat, 'proposal');
    await waitForStep(env.chat, 'review', 10000);
    approveDecision(env.workflow, env.chat, 'review');
    await waitForStep(env.chat, 'completed', 2000);

    // Should have 2 epics
    const workflow = env.chat.getWorkflow();
    expect(workflow.epicNumber).toBe(2);
    expect(workflow.epics.length).toBe(2);
    expect(workflow.epics[0].topic).toBe('Epic 1: Setup project');
    expect(workflow.epics[1].topic).toBe('Epic 2: Add features');
  });

  it('should accumulate session records across epics', async () => {
    await runFullCycle(env, 'Epic 1: Initial setup');

    const firstRecords = env.sessions.getRecords().length;
    expect(firstRecords).toBeGreaterThan(0);

    // Start and run second epic (must be >10 chars to trigger startNextEpic)
    env.workflow.handleUserMessage('Epic 2: Add more features');
    await waitForStep(env.chat, 'onboarding', 2000);
    env.workflow.handleUserMessage('다음');
    await waitForStep(env.chat, 'prediction', 2000);
    approveDecision(env.workflow, env.chat, 'prediction');
    await waitForStep(env.chat, 'documentation', 2000);
    approveDecision(env.workflow, env.chat, 'documentation');
    await waitForStep(env.chat, 'development', 2000);
    approveDecision(env.workflow, env.chat, 'proposal');
    await waitForStep(env.chat, 'review', 10000);
    approveDecision(env.workflow, env.chat, 'review');
    await waitForStep(env.chat, 'completed', 2000);

    expect(env.sessions.getRecords().length).toBeGreaterThan(firstRecords);
  });
});
