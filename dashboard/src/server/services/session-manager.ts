/**
 * SessionManager — Persists bot execution records to .claudebot/sessions.json.
 */
import fs from 'node:fs';
import path from 'node:path';
import type { SessionRecord } from '../../shared/api-types.js';

interface SessionStore {
  version: 1;
  projectCwd: string;
  totalCostUsd: number;
  records: SessionRecord[];
}

export class SessionManager {
  private storePath: string | null = null;
  private store: SessionStore | null = null;

  setProjectPath(projectPath: string): void {
    this.storePath = path.join(projectPath, '.claudebot', 'sessions.json');
    this.load();
  }

  private load(): void {
    if (!this.storePath) return;
    try {
      if (fs.existsSync(this.storePath)) {
        this.store = JSON.parse(fs.readFileSync(this.storePath, 'utf-8'));
      }
    } catch {
      this.store = null;
    }
    if (!this.store) {
      this.store = {
        version: 1,
        projectCwd: path.dirname(path.dirname(this.storePath)),
        totalCostUsd: 0,
        records: [],
      };
    }
  }

  private save(): void {
    if (!this.storePath || !this.store) return;
    const dir = path.dirname(this.storePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(this.storePath, JSON.stringify(this.store, null, 2), 'utf-8');
  }

  addRecord(record: SessionRecord): void {
    if (!this.store) return;
    this.store.records.push(record);
    this.store.totalCostUsd += record.costUsd;
    this.save();
  }

  getRecords(): SessionRecord[] {
    return this.store?.records ?? [];
  }

  getTotalCost(): number {
    return this.store?.totalCostUsd ?? 0;
  }

  getStore(): SessionStore | null {
    return this.store;
  }

  /**
   * Check if budget limit has been reached.
   */
  isBudgetExceeded(maxBudget: number | undefined): boolean {
    if (!maxBudget) return false;
    return this.getTotalCost() >= maxBudget;
  }
}
