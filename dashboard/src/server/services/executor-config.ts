import path from 'node:path';
import type { ExecutorConfig } from './executor-types.js';
import { readConfig } from './file-reader.js';

const DEFAULT_TIMEOUT_MS = 600_000;
const DEFAULT_MAX_TURNS = 24;
const DEFAULT_RETRY_ON_MAX_TURNS = true;
const DEFAULT_MAX_TURNS_RETRY_INCREMENT = 8;
const DEFAULT_MAX_TURNS_RETRY_LIMIT = 48;
const DEFAULT_DEV_HEARTBEAT_INTERVAL_MS = 45_000;
// Dashboard bot workflows are unattended; interactive approvals can abort tasks.
const DEFAULT_PERMISSION: ExecutorConfig['permissionMode'] = 'bypassPermissions';
const DEFAULT_LOG_LEVEL: ExecutorConfig['logLevel'] = 'info';

function toPositiveNumber(v: unknown): number | undefined {
  if (typeof v !== 'number' || !Number.isFinite(v) || v <= 0) return undefined;
  return v;
}

function toPositiveInt(v: unknown): number | undefined {
  const n = toPositiveNumber(v);
  if (n === undefined) return undefined;
  return Math.floor(n);
}

function toPermissionMode(v: unknown): ExecutorConfig['permissionMode'] | undefined {
  if (v === 'default' || v === 'acceptEdits' || v === 'bypassPermissions') return v;
  return undefined;
}

function toLogLevel(v: unknown): ExecutorConfig['logLevel'] | undefined {
  if (v === 'debug' || v === 'info' || v === 'warn' || v === 'error') return v;
  return undefined;
}

function toAllowedTools(v: unknown): string[] | undefined {
  if (!Array.isArray(v)) return undefined;
  const tools = v.filter((item): item is string => typeof item === 'string' && item.length > 0);
  return tools.length > 0 ? tools : undefined;
}

function toBoolean(v: unknown): boolean | undefined {
  if (typeof v !== 'boolean') return undefined;
  return v;
}

export function buildExecutorConfig(projectPath: string): ExecutorConfig {
  const raw = readConfig(projectPath) ?? {};
  const cwdValue = typeof raw.cwd === 'string' && raw.cwd.trim().length > 0 ? raw.cwd.trim() : projectPath;
  const cwd = path.isAbsolute(cwdValue) ? cwdValue : path.resolve(projectPath, cwdValue);

  return {
    model: typeof raw.model === 'string' ? raw.model : undefined,
    cwd,
    permissionMode: toPermissionMode(raw.permissionMode) ?? DEFAULT_PERMISSION,
    maxBudgetPerTaskUsd: toPositiveNumber(raw.maxBudgetPerTaskUsd),
    maxTurnsPerTask: toPositiveInt(raw.maxTurnsPerTask) ?? DEFAULT_MAX_TURNS,
    maxTotalBudgetUsd: toPositiveNumber(raw.maxTotalBudgetUsd),
    taskTimeoutMs: toPositiveInt(raw.taskTimeoutMs) ?? DEFAULT_TIMEOUT_MS,
    logLevel: toLogLevel(raw.logLevel) ?? DEFAULT_LOG_LEVEL,
    allowedTools: toAllowedTools(raw.allowedTools),
    systemPromptPrefix: typeof raw.systemPromptPrefix === 'string' ? raw.systemPromptPrefix : undefined,
    autoOnboarding: typeof raw.autoOnboarding === 'boolean' ? raw.autoOnboarding : false,
    retryOnMaxTurns: toBoolean(raw.retryOnMaxTurns) ?? DEFAULT_RETRY_ON_MAX_TURNS,
    maxTurnsRetryIncrement: toPositiveInt(raw.maxTurnsRetryIncrement) ?? DEFAULT_MAX_TURNS_RETRY_INCREMENT,
    maxTurnsRetryLimit: toPositiveInt(raw.maxTurnsRetryLimit) ?? DEFAULT_MAX_TURNS_RETRY_LIMIT,
    developmentHeartbeatIntervalMs:
      toPositiveInt(raw.developmentHeartbeatIntervalMs) ?? DEFAULT_DEV_HEARTBEAT_INTERVAL_MS,
  };
}
