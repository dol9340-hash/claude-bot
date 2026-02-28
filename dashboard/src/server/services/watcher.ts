import { watch, type FSWatcher } from 'chokidar';
import type { ServerResponse } from 'node:http';
import path from 'node:path';
import type { SSEEventType } from '../../shared/api-types.js';

type SSEClient = ServerResponse;

export class Watcher {
  private fsWatcher: FSWatcher | null = null;
  private clients = new Set<SSEClient>();
  private debounceTimers = new Map<string, NodeJS.Timeout>();
  private heartbeatInterval: ReturnType<typeof setInterval> | null = null;

  start(projectPath: string): void {
    this.stop();

    const patterns = [
      path.join(projectPath, '.claudebot', 'sessions.json'),
      path.join(projectPath, '**', 'todo.md'),
      path.join(projectPath, 'claudebot.config.json'),
    ];

    this.fsWatcher = watch(patterns, {
      ignoreInitial: true,
      awaitWriteFinish: { stabilityThreshold: 300 },
    });

    this.fsWatcher.on('change', (filePath) => {
      this.handleFileChange(filePath as string);
    });

    this.fsWatcher.on('add', (filePath) => {
      this.handleFileChange(filePath as string);
    });

    // Heartbeat every 30 seconds
    this.heartbeatInterval = setInterval(() => {
      this.broadcast('heartbeat');
    }, 30_000);
  }

  stop(): void {
    if (this.fsWatcher) {
      this.fsWatcher.close();
      this.fsWatcher = null;
    }
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }
    for (const timer of this.debounceTimers.values()) {
      clearTimeout(timer);
    }
    this.debounceTimers.clear();
  }

  addClient(client: SSEClient): void {
    this.clients.add(client);
    this.sendToClient(client, 'connected');
  }

  removeClient(client: SSEClient): void {
    this.clients.delete(client);
  }

  private handleFileChange(filePath: string): void {
    const basename = path.basename(filePath);
    let eventType: SSEEventType;

    if (basename === 'sessions.json') {
      eventType = 'sessions_updated';
    } else if (basename.endsWith('.md')) {
      eventType = 'tasks_updated';
    } else if (basename.includes('config')) {
      eventType = 'config_updated';
    } else {
      return;
    }

    // 500ms debounce per event type
    const existing = this.debounceTimers.get(eventType);
    if (existing) clearTimeout(existing);

    this.debounceTimers.set(
      eventType,
      setTimeout(() => {
        this.broadcast(eventType);
        this.debounceTimers.delete(eventType);
      }, 500),
    );
  }

  private broadcast(eventType: SSEEventType): void {
    const data = JSON.stringify({ type: eventType });
    for (const client of this.clients) {
      this.sendToClient(client, eventType, data);
    }
  }

  private sendToClient(client: SSEClient, eventType: SSEEventType, data?: string): void {
    try {
      const payload = data ?? JSON.stringify({ type: eventType });
      client.write(`event: ${eventType}\ndata: ${payload}\n\n`);
    } catch {
      this.clients.delete(client);
    }
  }
}
