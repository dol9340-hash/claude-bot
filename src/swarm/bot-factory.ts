import fs from 'node:fs';
import path from 'node:path';
import type { ClaudeBotConfig } from '../types.js';
import type { BotDefinition, SwarmFileConfig } from './types.js';

/**
 * Build a ClaudeBotConfig for a specific bot from a BotDefinition.
 * Each bot gets its own config derived from the swarm config + bot-specific overrides.
 */
export function buildBotConfig(
  botName: string,
  def: BotDefinition,
  swarmConfig: SwarmFileConfig,
  projectRoot: string,
): ClaudeBotConfig {
  const workspacePath = path.resolve(
    projectRoot,
    swarmConfig.swarmGraph.workspacePath,
  );

  // Resolve system prompt
  let systemPromptPrefix: string | undefined;
  if (def.systemPrompt) {
    systemPromptPrefix = def.systemPrompt;
  } else if (def.systemPromptFile) {
    const promptPath = path.resolve(projectRoot, def.systemPromptFile);
    if (fs.existsSync(promptPath)) {
      systemPromptPrefix = fs.readFileSync(promptPath, 'utf-8');
    }
  }

  // Build the inbox path as the bot's tasksFile
  const inboxPath = path.join(
    swarmConfig.swarmGraph.workspacePath,
    'inbox',
    `${botName}.md`,
  );

  // Determine the bot's primary tasks file:
  // - Entry bots with watchesFiles use the first watch glob
  // - All bots also read from their inbox
  const isEntryBot = swarmConfig.swarmGraph.entryBots.includes(botName);
  const tasksFile = isEntryBot && def.watchesFiles.length > 0
    ? def.watchesFiles[0]
    : inboxPath;

  // Bot-specific workspace for session storage
  const botWorkspaceDir = def.workspaceDir ?? botName;
  const sessionStorePath = path.join(
    swarmConfig.swarmGraph.workspacePath,
    botWorkspaceDir,
    'sessions.json',
  );

  return {
    engine: def.engine ?? swarmConfig.engine,
    tasksFile,
    cwd: projectRoot,
    model: def.model,
    permissionMode: def.permissionMode ?? swarmConfig.permissionMode,
    maxBudgetPerTaskUsd: def.maxBudgetPerTaskUsd,
    maxTurnsPerTask: def.maxTurnsPerTask,
    maxTotalBudgetUsd: swarmConfig.maxTotalBudgetUsd,
    taskTimeoutMs: swarmConfig.swarmGraph.stuckTaskTimeoutMs,
    maxRetries: 1,
    stopOnFailure: false,
    sessionStorePath,
    logLevel: 'info',
    allowedTools: def.allowedTools,
    systemPromptPrefix,
    watchIntervalMs: swarmConfig.watchIntervalMs,
  };
}

/**
 * Build the inbox system prompt appendix that tells the bot
 * about its communication capabilities.
 */
export function buildBotSystemContext(
  botName: string,
  def: BotDefinition,
  swarmConfig: SwarmFileConfig,
): string {
  const wp = swarmConfig.swarmGraph.workspacePath;
  const lines: string[] = [
    `\n\n--- BotGraph Context (${botName}) ---`,
    `You are "${botName}" in a multi-bot team.`,
    `Your inbox: ${wp}/inbox/${botName}.md`,
    `Shared board: ${wp}/${swarmConfig.swarmGraph.boardFile}`,
    `Registry: ${wp}/${swarmConfig.swarmGraph.registryFile}`,
  ];

  if (def.canContact.length > 0) {
    lines.push(`You can send messages to: ${def.canContact.join(', ')}`);
    lines.push('');
    lines.push('To send a message, append a line to the target bot\'s inbox file:');
    lines.push(`  ${wp}/inbox/{botName}.md`);
    lines.push('Use envelope format: - [ ] MSG-NNN | from:${botName} | to:{target} | subject:{SUBJECT} | {body}');
  } else {
    lines.push('You cannot send messages to other bots.');
  }

  if (def.terminatesOnEmpty) {
    lines.push('');
    lines.push('When all tasks are complete, write "SWARM_COMPLETE" to the board.');
  }

  lines.push('--- End BotGraph Context ---\n');
  return lines.join('\n');
}
