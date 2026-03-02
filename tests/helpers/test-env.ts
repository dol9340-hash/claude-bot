/**
 * Test environment setup — creates a full workflow stack with mock executor.
 */
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { ChatManager } from '../../dashboard/src/server/services/chat-manager.js';
import { WorkflowEngine } from '../../dashboard/src/server/services/workflow-engine.js';
import { BotComposer } from '../../dashboard/src/server/services/bot-composer.js';
import { MessageQueue } from '../../dashboard/src/server/services/message-queue.js';
import { SessionManager } from '../../dashboard/src/server/services/session-manager.js';
import { MockExecutor, type MockExecutorOptions } from './mock-executor.js';
import type { ExecutorConfig } from '../../dashboard/src/server/services/executor-types.js';

export interface TestEnv {
  projectPath: string;
  chat: ChatManager;
  workflow: WorkflowEngine;
  composer: BotComposer;
  queue: MessageQueue;
  sessions: SessionManager;
  executor: MockExecutor;
  cleanup: () => void;
}

const DEFAULT_CONFIG: ExecutorConfig = {
  cwd: process.cwd(),
  permissionMode: 'acceptEdits',
  taskTimeoutMs: 60_000,
  logLevel: 'info',
  model: 'claude-sonnet-4-6',
  maxBudgetPerTaskUsd: 1.0,
  maxTotalBudgetUsd: 10.0,
};

export function createTestEnv(executorOpts?: MockExecutorOptions): TestEnv {
  // Create temp project dir
  const projectPath = fs.mkdtempSync(path.join(os.tmpdir(), 'claudebot-test-'));

  const executor = new MockExecutor(executorOpts);
  const chat = new ChatManager();
  const composer = new BotComposer(executor, chat);
  const queue = new MessageQueue();
  const sessions = new SessionManager();

  composer.setBaseConfig(DEFAULT_CONFIG);

  const workflow = new WorkflowEngine(chat);
  workflow.setBotComposer(composer);
  workflow.setMessageQueue(queue);
  workflow.setSessionManager(sessions);

  // Set project paths
  chat.setProjectPath(projectPath);
  sessions.setProjectPath(projectPath);
  workflow.setProjectPath(projectPath);

  const cleanup = () => {
    try {
      fs.rmSync(projectPath, { recursive: true, force: true });
    } catch { /* ignore */ }
  };

  return { projectPath, chat, workflow, composer, queue, sessions, executor, cleanup };
}

/**
 * Wait for workflow to reach a specific step.
 * Polls every `intervalMs` up to `timeoutMs`.
 */
export async function waitForStep(
  chat: ChatManager,
  step: string,
  timeoutMs = 5000,
  intervalMs = 50,
): Promise<void> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    if (chat.getWorkflow().step === step) return;
    await new Promise(r => setTimeout(r, intervalMs));
  }
  throw new Error(`Timed out waiting for step "${step}" (current: "${chat.getWorkflow().step}")`);
}

/**
 * Advance through onboarding by sending a topic and then "다음".
 */
export async function advanceThroughOnboarding(
  workflow: WorkflowEngine,
  chat: ChatManager,
  topic = 'Test project',
): Promise<void> {
  // Send initial topic message
  workflow.handleUserMessage(topic);
  await waitForStep(chat, 'onboarding', 1000);

  // Advance to prediction
  workflow.handleUserMessage('다음');
  await waitForStep(chat, 'prediction', 2000);
}

/**
 * Approve a pending decision of the given type.
 */
export function approveDecision(
  workflow: WorkflowEngine,
  chat: ChatManager,
  type: string,
): boolean {
  const pending = chat.getWorkflow().decisions.filter(d => d.status === 'pending' && d.type === type);
  if (pending.length === 0) return false;
  const card = chat.resolveDecision(pending[0].id, 'approved');
  if (card) {
    workflow.handleDecisionResolved(card);
    return true;
  }
  return false;
}
