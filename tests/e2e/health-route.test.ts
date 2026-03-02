import { describe, it, expect } from 'vitest';
import { healthRoute } from '../../dashboard/src/server/routes/health.js';
import { buildHealthSnapshot } from '../../dashboard/src/server/services/health.js';

describe('Health Route', () => {
  it('should register /health and return runtime snapshot', async () => {
    const handlers: Record<string, (req: unknown, reply: { send: (payload: unknown) => unknown }) => unknown> = {};

    const app = {
      appState: {
        projectPath: 'E:/AI/claude-bot',
        chatManager: {
          getWorkflow: () => ({ step: 'onboarding' }),
          getMessageCount: () => 12,
        },
      },
      get(path: string, handler: (req: unknown, reply: { send: (payload: unknown) => unknown }) => unknown) {
        handlers[path] = handler;
      },
    } as unknown as Parameters<typeof healthRoute>[0];

    await healthRoute(app);
    expect(typeof handlers['/health']).toBe('function');

    let sent: unknown;
    const reply = {
      send(payload: unknown) {
        sent = payload;
        return payload;
      },
    };

    const returned = await handlers['/health']({}, reply);
    expect(returned).toBe(sent);

    const snapshot = sent as ReturnType<typeof buildHealthSnapshot>;
    expect(snapshot.status).toBe('ok');
    expect(snapshot.projectPath).toBe('E:/AI/claude-bot');
    expect(snapshot.workflowStep).toBe('onboarding');
    expect(snapshot.messageCount).toBe(12);
    expect(snapshot.uptimeSec).toBeGreaterThanOrEqual(0);
    expect(new Date(snapshot.timestamp).toString()).not.toBe('Invalid Date');
  });

  it('should sanitize negative values in snapshot builder', () => {
    const snapshot = buildHealthSnapshot({
      projectPath: null,
      workflowStep: 'idle',
      messageCount: -5,
      uptimeSec: -1,
    });

    expect(snapshot.uptimeSec).toBe(0);
    expect(snapshot.messageCount).toBe(0);
  });
});
