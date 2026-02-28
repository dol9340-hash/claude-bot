import fs from 'node:fs';
import type { Task } from '../types.js';

/**
 * Update a task's checkbox in the markdown file.
 * - Completed: `[ ]` → `[x]`
 * - Failed: `[ ]` → `[!]` with error comment
 */
export function updateTaskInFile(filePath: string, task: Task): void {
  const raw = fs.readFileSync(filePath, 'utf-8');
  const hasCRLF = raw.includes('\r\n');
  const content = raw.replace(/\r\n/g, '\n');
  const lines = content.split('\n');
  const lineIndex = task.line - 1;

  if (lineIndex < 0 || lineIndex >= lines.length) return;

  const line = lines[lineIndex];

  if (task.status === 'completed') {
    lines[lineIndex] = line.replace(/\[ \]/, '[x]');
  } else if (task.status === 'failed') {
    lines[lineIndex] = line.replace(/\[ \]/, '[!]')
      + ` <!-- FAILED: retry ${task.retryCount} -->`;
  }

  const eol = hasCRLF ? '\r\n' : '\n';
  fs.writeFileSync(filePath, lines.join(eol), 'utf-8');
}
