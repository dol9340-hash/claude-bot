import { z } from 'zod';
import path from 'node:path';
import fs from 'node:fs';
import type { ClaudeBotConfig } from './types.js';

const ClaudeBotConfigSchema = z.object({
  engine: z.enum(['sdk', 'cli']).default('sdk'),
  tasksFile: z.string().default('docs/todo.md'),
  cwd: z.string().default(process.cwd()),
  model: z.string().optional(),
  permissionMode: z.enum(['default', 'acceptEdits', 'bypassPermissions']).default('acceptEdits'),
  allowDangerouslySkipPermissions: z.boolean().optional(),
  maxBudgetPerTaskUsd: z.number().positive().optional(),
  maxTurnsPerTask: z.number().int().positive().optional(),
  maxTotalBudgetUsd: z.number().positive().optional(),
  taskTimeoutMs: z.number().int().positive().default(600_000),
  maxRetries: z.number().int().min(0).default(2),
  stopOnFailure: z.boolean().default(false),
  sessionStorePath: z.string().default('.claudebot/sessions.json'),
  logLevel: z.enum(['debug', 'info', 'warn', 'error']).default('info'),
  allowedTools: z.array(z.string()).optional(),
  watchIntervalMs: z.number().int().min(0).default(20_000),
  systemPromptPrefix: z.string().optional(),
  swarm: z.object({
    enabled: z.boolean(),
    agents: z.record(z.string(), z.object({
      description: z.string(),
      prompt: z.string(),
      tools: z.array(z.string()).optional(),
      model: z.enum(['sonnet', 'opus', 'haiku', 'inherit']).optional(),
      maxTurns: z.number().optional(),
    })),
    mainAgent: z.string().optional(),
  }).optional(),
});

const CONFIG_FILES = [
  'claudebot.config.json',
  'claudebot.config.js',
  'claudebot.config.ts',
];

/**
 * Loads config from file, merges with CLI overrides, validates with Zod.
 */
export async function loadConfig(
  cliOverrides: Partial<ClaudeBotConfig> = {},
): Promise<ClaudeBotConfig> {
  let fileConfig: Record<string, unknown> = {};

  for (const filename of CONFIG_FILES) {
    const fullPath = path.resolve(process.cwd(), filename);
    if (fs.existsSync(fullPath)) {
      if (filename.endsWith('.json')) {
        fileConfig = JSON.parse(fs.readFileSync(fullPath, 'utf-8'));
      } else {
        const mod = await import(fullPath);
        fileConfig = mod.default ?? mod;
      }
      break;
    }
  }

  // Remove undefined values from overrides to avoid overwriting file config
  const cleanOverrides: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(cliOverrides)) {
    if (value !== undefined) {
      cleanOverrides[key] = value;
    }
  }

  const merged = { ...fileConfig, ...cleanOverrides };
  return ClaudeBotConfigSchema.parse(merged) as ClaudeBotConfig;
}
