/**
 * E2E: 예산 초과 시 자동 중단 테스트
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createTestEnv, type TestEnv } from '../helpers/test-env.js';
import { SessionManager } from '../../dashboard/src/server/services/session-manager.js';

describe('Budget Auto-Stop', () => {
  let env: TestEnv;

  beforeEach(() => {
    env = createTestEnv({ delayMs: 10, success: true, costPerTask: 5.0 });
  });

  afterEach(() => {
    env.cleanup();
  });

  it('should detect budget exceeded via SessionManager', () => {
    // Add a record that exceeds budget
    env.sessions.addRecord({
      sessionId: 'test-1',
      prompt: 'test',
      costUsd: 15.0,
      durationMs: 1000,
      success: true,
      timestamp: new Date().toISOString(),
      phase: 'development',
    });

    expect(env.sessions.getTotalCost()).toBe(15.0);
    expect(env.sessions.isBudgetExceeded(10.0)).toBe(true);
    expect(env.sessions.isBudgetExceeded(20.0)).toBe(false);
    expect(env.sessions.isBudgetExceeded(undefined)).toBe(false);
  });

  it('should persist session records across loads', () => {
    env.sessions.addRecord({
      sessionId: 'test-persist',
      prompt: 'persist test',
      costUsd: 3.0,
      durationMs: 500,
      success: true,
      timestamp: new Date().toISOString(),
      phase: 'development',
    });

    // Create new SessionManager and load from same path
    const sessions2 = new SessionManager();
    sessions2.setProjectPath(env.projectPath);

    expect(sessions2.getRecords().length).toBe(1);
    expect(sessions2.getTotalCost()).toBe(3.0);
  });
});
