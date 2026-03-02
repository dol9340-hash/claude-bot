import { z } from 'zod';
import path from 'node:path';
import fs from 'node:fs';
import type { ClaudeBotConfig } from './types.js';

const ConfigSchema = z.object({
  model: z.string().optional(),
  cwd: z.string().default(process.cwd()),
  permissionMode: z.enum(['default', 'acceptEdits', 'bypassPermissions']).default('acceptEdits'),
  maxBudgetPerTaskUsd: z.number().positive().optional(),
  maxTurnsPerTask: z.number().int().positive().optional(),
  maxTotalBudgetUsd: z.number().positive().optional(),
  taskTimeoutMs: z.number().int().positive().default(600_000),
  logLevel: z.enum(['debug', 'info', 'warn', 'error']).default('info'),
  allowedTools: z.array(z.string()).optional(),
  systemPromptPrefix: z.string().optional(),
  autoOnboarding: z.boolean().default(false),
  retryOnMaxTurns: z.boolean().default(true),
  maxTurnsRetryIncrement: z.number().int().positive().default(8),
  maxTurnsRetryLimit: z.number().int().positive().default(48),
  developmentHeartbeatIntervalMs: z.number().int().positive().default(45_000),
});

/**
 * Loads config from claudebot.config.json if present.
 */
export function loadConfig(projectPath: string): ClaudeBotConfig {
  const configPath = path.join(projectPath, 'claudebot.config.json');
  let fileConfig: Record<string, unknown> = {};

  if (fs.existsSync(configPath)) {
    try {
      fileConfig = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
    } catch {
      // ignore parse errors, use defaults
    }
  }

  return ConfigSchema.parse(fileConfig) as ClaudeBotConfig;
}
