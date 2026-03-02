import fs from 'node:fs';
import path from 'node:path';
import type { ClaudeBotConfig, SessionStore } from '../../shared/types.js';
import type { ProjectInfo } from '../../shared/api-types.js';

const CONFIG_FILENAMES = ['claudebot.config.json'];
const DEFAULT_SESSION_STORE = '.claudebot/sessions.json';
const AGENTS_MD = 'AGENTS.md';

export function readSessionStore(projectPath: string): SessionStore | null {
  const filePath = path.join(projectPath, DEFAULT_SESSION_STORE);
  try {
    const raw = fs.readFileSync(filePath, 'utf-8');
    return JSON.parse(raw) as SessionStore;
  } catch {
    return null;
  }
}

export function readConfig(projectPath: string): Partial<ClaudeBotConfig> | null {
  for (const filename of CONFIG_FILENAMES) {
    const filePath = path.join(projectPath, filename);
    try {
      const raw = fs.readFileSync(filePath, 'utf-8');
      return JSON.parse(raw) as Partial<ClaudeBotConfig>;
    } catch {
      continue;
    }
  }
  return null;
}

/**
 * Read AGENTS.md from project root (if exists)
 */
export function readAgentsMd(projectPath: string): string | null {
  const filePath = path.join(projectPath, AGENTS_MD);
  try {
    return fs.readFileSync(filePath, 'utf-8');
  } catch {
    return null;
  }
}

/**
 * Scan docs/ folder and return { filename → first N lines } map
 */
export function scanDocsFolder(projectPath: string, maxLines = 30): Record<string, string> | null {
  const docsDir = path.join(projectPath, 'docs');
  if (!fs.existsSync(docsDir) || !fs.statSync(docsDir).isDirectory()) {
    return null;
  }

  const result: Record<string, string> = {};
  try {
    const files = fs.readdirSync(docsDir).filter(f => f.endsWith('.md'));
    for (const file of files.slice(0, 10)) {
      try {
        const content = fs.readFileSync(path.join(docsDir, file), 'utf-8');
        const lines = content.split('\n').slice(0, maxLines);
        result[file] = lines.join('\n');
      } catch { /* skip unreadable */ }
    }
  } catch {
    return null;
  }

  return Object.keys(result).length > 0 ? result : null;
}

export function validateProject(projectPath: string): ProjectInfo {
  const configExists = CONFIG_FILENAMES.some((f) =>
    fs.existsSync(path.join(projectPath, f)),
  );

  return {
    path: projectPath,
    valid: fs.existsSync(projectPath) && fs.statSync(projectPath).isDirectory(),
    hasConfigFile: configExists,
  };
}
