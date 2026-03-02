/**
 * E2E: 서버 재시작 후 chat.json 복원 테스트
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { ChatManager } from '../../dashboard/src/server/services/chat-manager.js';
import { createTestEnv, waitForStep, type TestEnv } from '../helpers/test-env.js';

describe('Chat Recovery (chat.json)', () => {
  let env: TestEnv;

  beforeEach(() => {
    env = createTestEnv({ delayMs: 10 });
  });

  afterEach(() => {
    env.cleanup();
  });

  it('should persist messages to chat.json', () => {
    env.chat.addMessage('user', 'Hello');
    env.chat.addMessage('orchestrator', 'Hi there!');

    const messages = env.chat.getMessages();
    expect(messages.length).toBe(2);
    expect(messages[0].content).toBe('Hello');
    expect(messages[1].content).toBe('Hi there!');
  });

  it('should recover messages after reload', () => {
    env.chat.addMessage('user', 'Persistent message');
    env.chat.setStep('onboarding');
    env.chat.setTopic('Recovery test');

    // Simulate server restart — create new ChatManager, load from same path
    const chat2 = new ChatManager();
    chat2.setProjectPath(env.projectPath);

    const messages = chat2.getMessages();
    expect(messages.length).toBe(1);
    expect(messages[0].content).toBe('Persistent message');

    const workflow = chat2.getWorkflow();
    expect(workflow.step).toBe('onboarding');
    expect(workflow.topic).toBe('Recovery test');
  });

  it('should recover workflow state including epic data', () => {
    // Set up some epic state
    env.chat.setStep('completed');
    env.chat.completeEpic({
      epicNumber: 1,
      topic: 'First epic',
      startedAt: new Date().toISOString(),
      completedAt: new Date().toISOString(),
      totalCostUsd: 0.5,
      durationMs: 60000,
      tasksCompleted: 3,
      tasksFailed: 0,
      botNames: ['developer', 'reviewer'],
      modifiedFiles: ['src/index.ts'],
    });

    // Reload
    const chat2 = new ChatManager();
    chat2.setProjectPath(env.projectPath);

    const workflow = chat2.getWorkflow();
    expect(workflow.epicNumber).toBe(1);
    expect(workflow.epics.length).toBe(1);
    expect(workflow.epics[0].topic).toBe('First epic');
    expect(workflow.epics[0].tasksCompleted).toBe(3);
  });

  it('should recover decision cards', () => {
    env.chat.createDecision('prediction', 'Test Decision', 'Test description', ['Approve', 'Reject']);

    // Reload
    const chat2 = new ChatManager();
    chat2.setProjectPath(env.projectPath);

    const pending = chat2.getPendingDecisions();
    expect(pending.length).toBe(1);
    expect(pending[0].title).toBe('Test Decision');
    expect(pending[0].status).toBe('pending');
  });

  it('should handle corrupted chat.json gracefully', () => {
    // Write corrupted JSON — ensure .claudebot/ dir exists first
    const fs = require('node:fs');
    const path = require('node:path');
    const chatDir = path.join(env.projectPath, '.claudebot');
    fs.mkdirSync(chatDir, { recursive: true });
    const chatPath = path.join(chatDir, 'chat.json');
    fs.writeFileSync(chatPath, 'NOT VALID JSON', 'utf-8');

    // Should not throw, should create empty store
    const chat2 = new ChatManager();
    chat2.setProjectPath(env.projectPath);

    expect(chat2.getMessages().length).toBe(0);
    expect(chat2.getWorkflow().step).toBe('idle');
  });
});
