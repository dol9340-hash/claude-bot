import fs from 'node:fs';
import path from 'node:path';
import type { Logger } from 'pino';
import type { SwarmFileConfig } from './types.js';

/**
 * Bootstrap the workspace directory structure based on swarm config.
 * Creates: workspace root, inbox/, per-bot workspace dirs, board.md, registry.json.
 */
export function bootstrapWorkspace(
  swarmConfig: SwarmFileConfig,
  projectRoot: string,
  logger: Logger,
): void {
  const sg = swarmConfig.swarmGraph;
  const workspacePath = path.resolve(projectRoot, sg.workspacePath);

  // Create workspace root
  ensureDir(workspacePath);

  // Create inbox directory
  const inboxDir = path.join(workspacePath, 'inbox');
  ensureDir(inboxDir);

  // Create per-bot directories and inbox files
  for (const [botName, def] of Object.entries(sg.bots)) {
    // Bot workspace directory
    const botDir = path.join(workspacePath, def.workspaceDir ?? botName);
    ensureDir(botDir);

    // Bot inbox file
    const inboxPath = path.join(inboxDir, `${botName}.md`);
    if (!fs.existsSync(inboxPath)) {
      fs.writeFileSync(
        inboxPath,
        `# Inbox: ${botName}\n\n`,
        'utf-8',
      );
    }
  }

  // Create board.md
  const boardPath = path.join(workspacePath, sg.boardFile);
  if (!fs.existsSync(boardPath)) {
    const header = [
      '# BotGraph Board',
      '',
      '> Append-only shared log. All bots post here.',
      '',
    ].join('\n');
    fs.writeFileSync(boardPath, header, 'utf-8');
  }

  // Create registry.json
  const registryPath = path.join(workspacePath, sg.registryFile);
  if (!fs.existsSync(registryPath)) {
    const registry = {
      version: 1,
      tasks: {},
      messageCounter: 0,
    };
    fs.writeFileSync(
      registryPath,
      JSON.stringify(registry, null, 2),
      'utf-8',
    );
  }

  logger.info({ workspacePath }, 'Workspace bootstrapped');
}

function ensureDir(dirPath: string): void {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
}
