import fs from 'node:fs';
import path from 'node:path';
import type { Logger } from 'pino';

/**
 * BulletinBoard — append-only shared log file (board.md).
 * All bots can read; concurrent appends are safe (worst case: interleaved lines).
 */
export class BulletinBoard {
  private readonly boardPath: string;
  private readonly logger: Logger;

  constructor(workspacePath: string, boardFile: string, logger: Logger) {
    this.boardPath = path.resolve(workspacePath, boardFile);
    this.logger = logger;
  }

  /** Append a timestamped entry to the board. */
  post(botName: string, subject: string, message: string): void {
    const timestamp = new Date().toISOString();
    const entry = `\n## ${timestamp} | ${botName} | ${subject}\n${message}\n`;

    fs.appendFileSync(this.boardPath, entry, 'utf-8');
    this.logger.debug({ botName, subject }, 'Board post');
  }

  /** Read the entire board content. */
  read(): string {
    if (!fs.existsSync(this.boardPath)) return '';
    return fs.readFileSync(this.boardPath, 'utf-8');
  }

  /** Check if SWARM_COMPLETE has been posted. */
  isSwarmComplete(): boolean {
    const content = this.read();
    return content.includes('SWARM_COMPLETE');
  }

  /** Initialize the board file if it doesn't exist. */
  init(): void {
    if (!fs.existsSync(this.boardPath)) {
      const header = `# BotGraph Board\n\n> Append-only shared log. All bots post here.\n\n`;
      fs.writeFileSync(this.boardPath, header, 'utf-8');
    }
  }
}
