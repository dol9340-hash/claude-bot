import fs from 'node:fs';
import path from 'node:path';
import type { SessionStore, SessionRecord, TaskResult, EngineType } from '../types.js';
import type { Logger } from 'pino';

export class SessionManager {
  private store: SessionStore;
  private storePath: string;
  private logger: Logger;

  constructor(storePath: string, cwd: string, logger: Logger) {
    this.storePath = path.resolve(cwd, storePath);
    this.logger = logger;
    this.store = this.load();
  }

  private load(): SessionStore {
    try {
      if (fs.existsSync(this.storePath)) {
        const raw = fs.readFileSync(this.storePath, 'utf-8');
        return JSON.parse(raw) as SessionStore;
      }
    } catch (err) {
      this.logger.warn({ err }, 'Failed to load session store, starting fresh');
    }
    return {
      version: 1,
      projectCwd: process.cwd(),
      totalCostUsd: 0,
      records: [],
    };
  }

  save(): void {
    const dir = path.dirname(this.storePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(this.storePath, JSON.stringify(this.store, null, 2), 'utf-8');
  }

  recordResult(result: TaskResult, engine: EngineType): void {
    const record: SessionRecord = {
      taskLine: result.task.line,
      taskPrompt: result.task.prompt,
      sessionId: result.sessionId,
      costUsd: result.costUsd,
      durationMs: result.durationMs,
      status: result.success ? 'completed' : 'failed',
      timestamp: new Date().toISOString(),
      retryCount: result.task.retryCount,
      engine,
    };
    this.store.records.push(record);
    this.store.totalCostUsd += result.costUsd > 0 ? result.costUsd : 0;
    this.save();
  }

  findSessionForTask(taskLine: number): SessionRecord | undefined {
    return this.store.records
      .filter(r => r.taskLine === taskLine)
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())[0];
  }

  getTotalCost(): number {
    return this.store.totalCostUsd;
  }

  getStore(): SessionStore {
    return this.store;
  }
}
