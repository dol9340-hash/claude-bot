import fs from 'node:fs';
import type { Task } from '../types.js';

/**
 * Matches markdown checkboxes:
 *   - [ ] Some task text       => unchecked (pending)
 *   - [x] Some task text       => checked (completed)
 *   - [X] Some task text       => checked (completed)
 *   - [!] Some task text       => failed (marked by writer)
 */
const CHECKBOX_RE = /^(\s*[-*]\s*)\[([ xX!])\]\s+(.+)$/;

/** Matches inline tags like [cwd:/some/path] [budget:1.50] */
const TAG_RE = /\[(\w+):([^\]]+)\]/g;

/**
 * Parse a markdown file and extract all pending checkbox tasks.
 * Skips completed ([x]) and failed ([!]) tasks.
 */
export function parseTasks(filePath: string): Task[] {
  const content = fs.readFileSync(filePath, 'utf-8').replace(/\r\n/g, '\n');
  const lines = content.split('\n');
  const tasks: Task[] = [];

  for (let i = 0; i < lines.length; i++) {
    const match = lines[i].match(CHECKBOX_RE);
    if (!match) continue;

    const marker = match[2].toLowerCase();
    if (marker === 'x' || marker === '!') continue;

    const rawText = match[3];
    const tags: Record<string, string> = {};

    let tagMatch: RegExpExecArray | null;
    TAG_RE.lastIndex = 0;
    while ((tagMatch = TAG_RE.exec(rawText)) !== null) {
      tags[tagMatch[1]] = tagMatch[2];
    }

    const prompt = rawText.replace(TAG_RE, '').trim();

    tasks.push({
      line: i + 1,
      rawText,
      prompt,
      status: 'pending',
      cwd: tags['cwd'],
      maxBudgetUsd: tags['budget'] ? parseFloat(tags['budget']) : undefined,
      maxTurns: tags['turns'] ? parseInt(tags['turns'], 10) : undefined,
      agent: tags['agent'],
      priority: tags['priority'] ? parseInt(tags['priority'], 10) : undefined,
      retryCount: 0,
      tags,
    });
  }

  return tasks;
}
