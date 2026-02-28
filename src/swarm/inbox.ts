import fs from 'node:fs';
import path from 'node:path';
import type { Logger } from 'pino';
import type { BotMessage, SwarmGraphConfig } from './types.js';

/**
 * InboxManager — manages per-bot inbox files.
 * Enforces canContact whitelists on message sending.
 * Inbox files use markdown checkbox format compatible with parseTasks().
 */
export class InboxManager {
  private readonly inboxDir: string;
  private readonly config: SwarmGraphConfig;
  private readonly logger: Logger;
  private messageCounter: number;

  constructor(workspacePath: string, config: SwarmGraphConfig, logger: Logger, initialCounter = 0) {
    this.inboxDir = path.resolve(workspacePath, 'inbox');
    this.config = config;
    this.logger = logger;
    this.messageCounter = initialCounter;
  }

  /** Get the inbox file path for a bot. */
  getInboxPath(botName: string): string {
    return path.join(this.inboxDir, `${botName}.md`);
  }

  /** Initialize inbox files for all bots. */
  init(): void {
    if (!fs.existsSync(this.inboxDir)) {
      fs.mkdirSync(this.inboxDir, { recursive: true });
    }

    for (const botName of Object.keys(this.config.bots)) {
      const inboxPath = this.getInboxPath(botName);
      if (!fs.existsSync(inboxPath)) {
        fs.writeFileSync(
          inboxPath,
          `# Inbox: ${botName}\n\n`,
          'utf-8',
        );
      }
    }
  }

  /**
   * Send a message from one bot to another.
   * Enforces canContact whitelist.
   */
  sendMessage(
    from: string,
    to: string,
    subject: string,
    body: string,
    taskId?: string,
  ): BotMessage | null {
    // Validate canContact whitelist
    const senderDef = this.config.bots[from];
    if (!senderDef) {
      this.logger.error({ from }, 'Unknown sender bot');
      return null;
    }

    if (!senderDef.canContact.includes(to)) {
      this.logger.warn(
        { from, to },
        'Message rejected: canContact violation',
      );
      return null;
    }

    // Validate target exists
    if (!(to in this.config.bots)) {
      this.logger.error({ to }, 'Unknown target bot');
      return null;
    }

    const msgId = `MSG-${String(++this.messageCounter).padStart(3, '0')}`;
    const timestamp = new Date().toISOString();

    const message: BotMessage = {
      id: msgId,
      from,
      to,
      subject,
      taskId,
      body,
      timestamp,
    };

    // Write to inbox file as a markdown checkbox
    const taskIdPart = taskId ? ` | taskId:${taskId}` : '';
    const line = `- [ ] ${msgId} | from:${from} | to:${to} | subject:${subject}${taskIdPart} | ${body}\n`;

    const inboxPath = this.getInboxPath(to);
    fs.appendFileSync(inboxPath, line, 'utf-8');

    this.logger.debug({ from, to, subject, msgId }, 'Message sent');
    return message;
  }

  /** Get the current message counter (for persistence). */
  getMessageCounter(): number {
    return this.messageCounter;
  }

  /** Read pending (unchecked) messages from a bot's inbox. */
  readPendingMessages(botName: string): BotMessage[] {
    const inboxPath = this.getInboxPath(botName);
    if (!fs.existsSync(inboxPath)) return [];

    const content = fs.readFileSync(inboxPath, 'utf-8');
    const lines = content.split('\n');
    const messages: BotMessage[] = [];

    const msgRegex = /^-\s*\[ \]\s+(MSG-\d+)\s*\|\s*from:(\S+)\s*\|\s*to:(\S+)\s*\|\s*subject:(\S+)(?:\s*\|\s*taskId:(\S+))?\s*\|\s*(.+)$/;

    for (const line of lines) {
      const match = line.match(msgRegex);
      if (!match) continue;

      messages.push({
        id: match[1],
        from: match[2],
        to: match[3],
        subject: match[4],
        taskId: match[5] || undefined,
        body: match[6].trim(),
        timestamp: new Date().toISOString(),
      });
    }

    return messages;
  }

  /** Register a new bot's inbox dynamically (for Orchestrator phase). */
  registerBot(botName: string): void {
    const inboxPath = this.getInboxPath(botName);
    if (!fs.existsSync(inboxPath)) {
      fs.writeFileSync(
        inboxPath,
        `# Inbox: ${botName}\n\n`,
        'utf-8',
      );
      this.logger.info({ botName }, 'Dynamic inbox registered');
    }
  }

  /** Remove a bot's inbox (for Orchestrator phase). */
  unregisterBot(botName: string): void {
    const inboxPath = this.getInboxPath(botName);
    if (fs.existsSync(inboxPath)) {
      fs.unlinkSync(inboxPath);
      this.logger.info({ botName }, 'Inbox unregistered');
    }
  }
}
