import fs from 'node:fs';
import path from 'node:path';

const PREVIEW_DIR = path.join('.claudebot', 'previews');

function safeId(id: string): string | null {
  if (!id || typeof id !== 'string') return null;
  const trimmed = id.trim();
  if (!/^[a-z0-9][a-z0-9._-]{2,80}$/i.test(trimmed)) return null;
  return trimmed;
}

function ensureDir(projectPath: string): string {
  const dir = path.join(projectPath, PREVIEW_DIR);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  return dir;
}

export interface SavedPreview {
  id: string;
  path: string;
}

export function savePreviewHtml(projectPath: string, html: string, prefix = 'prediction'): SavedPreview {
  const dir = ensureDir(projectPath);
  const id = `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const filePath = path.join(dir, `${id}.html`);
  fs.writeFileSync(filePath, html, 'utf-8');
  return { id, path: filePath };
}

export function readPreviewHtml(projectPath: string, id: string): string | null {
  const safe = safeId(id);
  if (!safe) return null;

  const filePath = path.join(projectPath, PREVIEW_DIR, `${safe}.html`);
  try {
    return fs.readFileSync(filePath, 'utf-8');
  } catch {
    return null;
  }
}

