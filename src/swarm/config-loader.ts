import fs from 'node:fs';
import path from 'node:path';
import { SwarmFileConfigSchema } from './types.js';
import type { SwarmFileConfig } from './types.js';

const SWARM_CONFIG_FILES = [
  'claudebot.swarm.json',
];

/**
 * Loads and validates a swarm config file.
 * @param configPath - Explicit path to config file, or auto-detect from cwd
 * @param cwd - Working directory for resolution
 */
export function loadSwarmConfig(configPath?: string, cwd?: string): SwarmFileConfig {
  const baseCwd = cwd ?? process.cwd();

  let filePath: string | undefined;

  if (configPath) {
    filePath = path.resolve(baseCwd, configPath);
  } else {
    for (const filename of SWARM_CONFIG_FILES) {
      const candidate = path.resolve(baseCwd, filename);
      if (fs.existsSync(candidate)) {
        filePath = candidate;
        break;
      }
    }
  }

  if (!filePath || !fs.existsSync(filePath)) {
    throw new Error(
      `Swarm config not found. Expected: ${configPath ?? SWARM_CONFIG_FILES.join(' or ')} in ${baseCwd}`,
    );
  }

  const raw = fs.readFileSync(filePath, 'utf-8');
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error(`Failed to parse swarm config: ${filePath}`);
  }

  const result = SwarmFileConfigSchema.safeParse(parsed);
  if (!result.success) {
    const issues = result.error.issues.map(
      i => `  - ${i.path.join('.')}: ${i.message}`,
    ).join('\n');
    throw new Error(`Invalid swarm config:\n${issues}`);
  }

  const config = result.data;

  // Validate that entryBots reference existing bot names
  for (const name of config.swarmGraph.entryBots) {
    if (!(name in config.swarmGraph.bots)) {
      throw new Error(`Entry bot "${name}" is not defined in swarmGraph.bots`);
    }
  }

  // Validate canContact references
  for (const [botName, def] of Object.entries(config.swarmGraph.bots)) {
    for (const target of def.canContact) {
      if (!(target in config.swarmGraph.bots)) {
        throw new Error(
          `Bot "${botName}" has canContact target "${target}" which is not defined in swarmGraph.bots`,
        );
      }
    }
  }

  return config;
}
