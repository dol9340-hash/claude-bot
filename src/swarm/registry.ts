import fs from 'node:fs';
import path from 'node:path';
import type { Logger } from 'pino';
import { RegistryStoreSchema } from './types.js';
import type { RegistryStore, RegistryEntry, TaskState } from './types.js';

const LOCK_TIMEOUT_MS = 5_000;
const LOCK_RETRY_INTERVAL_MS = 100;

/**
 * RegistryManager — atomic read/write of registry.json.
 * Uses a .registry.lock sentinel file for concurrency control.
 */
export class RegistryManager {
  private readonly registryPath: string;
  private readonly lockPath: string;
  private readonly logger: Logger;

  constructor(workspacePath: string, registryFile: string, logger: Logger) {
    this.registryPath = path.resolve(workspacePath, registryFile);
    this.lockPath = this.registryPath + '.lock';
    this.logger = logger;
  }

  /** Initialize the registry file if it doesn't exist. */
  init(): void {
    if (!fs.existsSync(this.registryPath)) {
      const store: RegistryStore = {
        version: 1,
        tasks: {},
        messageCounter: 0,
      };
      this.writeStore(store);
    }
  }

  /** Acquire a file-based lock. */
  private async acquireLock(): Promise<void> {
    const start = Date.now();
    while (Date.now() - start < LOCK_TIMEOUT_MS) {
      try {
        // Create lock file exclusively — fails if it already exists
        fs.writeFileSync(this.lockPath, String(process.pid), { flag: 'wx' });
        return;
      } catch {
        // Lock exists — check if it's stale
        if (fs.existsSync(this.lockPath)) {
          const stat = fs.statSync(this.lockPath);
          if (Date.now() - stat.mtimeMs > LOCK_TIMEOUT_MS) {
            // Stale lock — remove and retry
            this.logger.warn('Removing stale registry lock');
            fs.unlinkSync(this.lockPath);
            continue;
          }
        }
        await new Promise(resolve => setTimeout(resolve, LOCK_RETRY_INTERVAL_MS));
      }
    }
    throw new Error(`Failed to acquire registry lock after ${LOCK_TIMEOUT_MS}ms`);
  }

  /** Release the file-based lock. */
  private releaseLock(): void {
    try {
      if (fs.existsSync(this.lockPath)) {
        fs.unlinkSync(this.lockPath);
      }
    } catch {
      // Ignore cleanup errors
    }
  }

  /** Read the registry store. */
  readStore(): RegistryStore {
    if (!fs.existsSync(this.registryPath)) {
      return { version: 1, tasks: {}, messageCounter: 0 };
    }
    const raw = fs.readFileSync(this.registryPath, 'utf-8');
    const parsed = JSON.parse(raw);
    return RegistryStoreSchema.parse(parsed);
  }

  /** Write the registry store atomically. */
  private writeStore(store: RegistryStore): void {
    const dir = path.dirname(this.registryPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    // Write to temp file then rename for atomicity
    const tmpPath = this.registryPath + '.tmp';
    fs.writeFileSync(tmpPath, JSON.stringify(store, null, 2), 'utf-8');
    fs.renameSync(tmpPath, this.registryPath);
  }

  /**
   * Perform an atomic read-modify-write operation on the registry.
   * The callback receives the current store and should return the modified store.
   */
  async update(fn: (store: RegistryStore) => RegistryStore): Promise<RegistryStore> {
    await this.acquireLock();
    try {
      const store = this.readStore();
      const updated = fn(store);
      this.writeStore(updated);
      return updated;
    } finally {
      this.releaseLock();
    }
  }

  /** Register a new task in the registry. */
  async registerTask(
    taskId: string,
    description?: string,
    sourceFile?: string,
  ): Promise<RegistryEntry> {
    const now = new Date().toISOString();
    const entry: RegistryEntry = {
      taskId,
      state: 'pending',
      routingCycles: 0,
      costUsd: 0,
      createdAt: now,
      updatedAt: now,
      description,
      sourceFile,
    };

    await this.update(store => {
      store.tasks[taskId] = entry;
      return store;
    });

    this.logger.debug({ taskId }, 'Task registered');
    return entry;
  }

  /** Update a task's state. */
  async updateTaskState(
    taskId: string,
    state: TaskState,
    assignedTo?: string,
  ): Promise<void> {
    await this.update(store => {
      const task = store.tasks[taskId];
      if (!task) {
        this.logger.warn({ taskId }, 'Task not found in registry');
        return store;
      }
      task.state = state;
      task.updatedAt = new Date().toISOString();
      if (assignedTo !== undefined) {
        task.assignedTo = assignedTo;
      }
      return store;
    });
  }

  /** Increment routing cycles for a task. Returns true if under limit. */
  async incrementRoutingCycles(taskId: string, maxCycles: number): Promise<boolean> {
    let underLimit = true;
    await this.update(store => {
      const task = store.tasks[taskId];
      if (!task) return store;
      task.routingCycles++;
      task.updatedAt = new Date().toISOString();
      if (task.routingCycles >= maxCycles) {
        task.state = 'failed';
        underLimit = false;
      }
      return store;
    });
    return underLimit;
  }

  /** Record cost for a task. */
  async recordCost(taskId: string, costUsd: number): Promise<void> {
    await this.update(store => {
      const task = store.tasks[taskId];
      if (!task) return store;
      task.costUsd += costUsd;
      task.updatedAt = new Date().toISOString();
      return store;
    });
  }

  /** Get all tasks with a specific state. */
  getTasksByState(state: TaskState): RegistryEntry[] {
    const store = this.readStore();
    return Object.values(store.tasks).filter(t => t.state === state);
  }

  /** Check if all tasks are in terminal states (done or failed). */
  allTasksTerminal(): boolean {
    const store = this.readStore();
    const tasks = Object.values(store.tasks);
    if (tasks.length === 0) return false;
    return tasks.every(t => t.state === 'done' || t.state === 'failed');
  }

  /** Get the message counter and increment it. */
  async nextMessageId(): Promise<number> {
    let counter = 0;
    await this.update(store => {
      store.messageCounter++;
      counter = store.messageCounter;
      return store;
    });
    return counter;
  }
}
