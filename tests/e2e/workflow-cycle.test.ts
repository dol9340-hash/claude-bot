/**
 * E2E: Phase 1→5 전체 사이클 테스트
 * Onboarding → Prediction → Documentation → Development → Review → Completed
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  createTestEnv,
  waitForStep,
  advanceThroughOnboarding,
  approveDecision,
  type TestEnv,
} from '../helpers/test-env.js';

describe('Full Workflow Cycle (Phase 1→5)', () => {
  let env: TestEnv;

  beforeEach(() => {
    env = createTestEnv({ delayMs: 10, success: true, costPerTask: 0.05 });
  });

  afterEach(() => {
    env.cleanup();
  });

  it('should start at idle', () => {
    expect(env.chat.getWorkflow().step).toBe('idle');
  });

  it('should transition through onboarding to prediction', async () => {
    env.workflow.handleUserMessage('Build a REST API');
    expect(env.chat.getWorkflow().step).toBe('onboarding');
    expect(env.chat.getWorkflow().topic).toBe('Build a REST API');

    // Free conversation
    env.workflow.handleUserMessage('TypeScript + Express');
    expect(env.chat.getWorkflow().step).toBe('onboarding');

    // Advance
    env.workflow.handleUserMessage('다음');
    await waitForStep(env.chat, 'prediction', 2000);

    // Should have a pending prediction decision
    const pending = env.chat.getWorkflow().decisions.filter(d => d.status === 'pending');
    expect(pending.length).toBeGreaterThan(0);
    expect(pending[0].type).toBe('prediction');
    expect(pending[0].tabs).toBeDefined();
    expect(pending[0].tabs!.length).toBe(1);
  });

  it('should handle prediction approval and move to documentation', async () => {
    await advanceThroughOnboarding(env.workflow, env.chat, 'Test project');

    // Approve prediction
    approveDecision(env.workflow, env.chat, 'prediction');
    await waitForStep(env.chat, 'documentation', 2000);

    // Documentation decision should have 3 tabs (PRD, TechSpec, Tasks)
    const pending = env.chat.getWorkflow().decisions.filter(d => d.status === 'pending');
    expect(pending.length).toBeGreaterThan(0);
    expect(pending[0].type).toBe('documentation');
    expect(pending[0].tabs?.length).toBe(3);
  });

  it('should handle prediction modification (back to onboarding)', async () => {
    await advanceThroughOnboarding(env.workflow, env.chat);

    const decisions = env.chat.getWorkflow().decisions.filter(d => d.status === 'pending' && d.type === 'prediction');
    const card = env.chat.resolveDecision(decisions[0].id, 'modified', 'Add auth feature');
    env.workflow.handleDecisionResolved(card!);

    expect(env.chat.getWorkflow().step).toBe('onboarding');
  });

  it('should complete full Phase 1→5 cycle', async () => {
    // Phase 1: Onboarding → Phase 2: Prediction
    await advanceThroughOnboarding(env.workflow, env.chat, 'Build a TODO app');

    // Phase 2: Approve prediction → Phase 3: Documentation
    approveDecision(env.workflow, env.chat, 'prediction');
    await waitForStep(env.chat, 'documentation', 2000);

    // Phase 3: Approve documentation → Phase 4: Development (proposal)
    approveDecision(env.workflow, env.chat, 'documentation');
    await waitForStep(env.chat, 'development', 2000);

    // Phase 4: Approve bot team proposal → starts development
    approveDecision(env.workflow, env.chat, 'proposal');

    // Wait for development to complete and review to start
    await waitForStep(env.chat, 'review', 10000);

    // Phase 5: Review decision should exist
    const reviewDecisions = env.chat.getWorkflow().decisions.filter(
      d => d.status === 'pending' && d.type === 'review',
    );
    expect(reviewDecisions.length).toBe(1);
    expect(reviewDecisions[0].tabs).toBeDefined();

    // Approve review → completed
    approveDecision(env.workflow, env.chat, 'review');
    await waitForStep(env.chat, 'completed', 2000);

    // Verify epic was created
    const workflow = env.chat.getWorkflow();
    expect(workflow.epicNumber).toBe(1);
    expect(workflow.epics.length).toBe(1);
    expect(workflow.epics[0].topic).toBe('Build a TODO app');
  });

  it('should track costs through the cycle', async () => {
    await advanceThroughOnboarding(env.workflow, env.chat, 'Cost test');
    approveDecision(env.workflow, env.chat, 'prediction');
    await waitForStep(env.chat, 'documentation', 2000);
    approveDecision(env.workflow, env.chat, 'documentation');
    await waitForStep(env.chat, 'development', 2000);
    approveDecision(env.workflow, env.chat, 'proposal');
    await waitForStep(env.chat, 'review', 10000);
    approveDecision(env.workflow, env.chat, 'review');
    await waitForStep(env.chat, 'completed', 2000);

    // Mock executor should have been called (developer tasks + reviewer task)
    expect(env.executor.getCallCount()).toBeGreaterThan(0);

    // Session records should exist
    const records = env.sessions.getRecords();
    expect(records.length).toBeGreaterThan(0);
  });

  it('should record messages throughout the cycle', async () => {
    // handleUserMessage doesn't add user messages to chat (the route does),
    // so we add them manually before calling the handler.
    env.chat.addMessage('user', 'Messages test');
    env.workflow.handleUserMessage('Messages test');
    await waitForStep(env.chat, 'onboarding', 1000);

    env.chat.addMessage('user', '다음');
    env.workflow.handleUserMessage('다음');
    await waitForStep(env.chat, 'prediction', 2000);

    const messages = env.chat.getMessages();
    // Should have: user messages + orchestrator responses
    expect(messages.length).toBeGreaterThan(2);

    const userMsgs = messages.filter(m => m.role === 'user');
    expect(userMsgs.length).toBeGreaterThan(0);

    const orchMsgs = messages.filter(m => m.role === 'orchestrator');
    expect(orchMsgs.length).toBeGreaterThan(0);
  });
});
