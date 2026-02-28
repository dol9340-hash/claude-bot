import fs from 'node:fs';
import path from 'node:path';
import type { SessionStore, ClaudeBotConfig } from '../../shared/types.js';
import type { ProjectInfo } from '../../shared/api-types.js';
import { parseTasks } from './task-parser.js';
import type { Task } from '../../shared/types.js';

const CONFIG_FILENAMES = ['claudebot.config.json'];
const DEFAULT_TASKS_FILE = 'docs/todo.md';
const DEFAULT_SESSION_STORE = '.claudebot/sessions.json';

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

export function readTasks(projectPath: string, tasksFile?: string): Task[] {
  const file = tasksFile || DEFAULT_TASKS_FILE;
  const filePath = path.join(projectPath, file);
  try {
    const raw = fs.readFileSync(filePath, 'utf-8');
    return parseTasks(raw);
  } catch {
    return [];
  }
}

export function getTasksFilePath(projectPath: string): string {
  const config = readConfig(projectPath);
  return config?.tasksFile || DEFAULT_TASKS_FILE;
}

export function validateProject(projectPath: string): ProjectInfo {
  const tasksFilePath = getTasksFilePath(projectPath);
  const sessionsPath = path.join(projectPath, DEFAULT_SESSION_STORE);
  const configExists = CONFIG_FILENAMES.some((f) =>
    fs.existsSync(path.join(projectPath, f)),
  );
  const tasksExists = fs.existsSync(path.join(projectPath, tasksFilePath));
  const sessionsExists = fs.existsSync(sessionsPath);

  return {
    path: projectPath,
    valid: fs.existsSync(projectPath) && fs.statSync(projectPath).isDirectory(),
    hasSessionsFile: sessionsExists,
    hasConfigFile: configExists,
    hasTasksFile: tasksExists,
    tasksFilePath,
  };
}
