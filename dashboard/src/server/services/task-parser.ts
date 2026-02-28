import type { Task, TaskStatus } from '../../shared/types.js';

const CHECKBOX_RE = /^(\s*[-*]\s*)\[([ xX!])\]\s+(.+)$/;
const TAG_RE = /\[(\w+):([^\]]+)\]/g;

function parseStatus(marker: string): TaskStatus {
  switch (marker) {
    case 'x':
    case 'X':
      return 'completed';
    case '!':
      return 'failed';
    default:
      return 'pending';
  }
}

function extractTags(text: string): { prompt: string; tags: Record<string, string> } {
  const tags: Record<string, string> = {};
  const prompt = text.replace(TAG_RE, (_, key: string, value: string) => {
    tags[key.toLowerCase()] = value.trim();
    return '';
  }).trim();
  return { prompt, tags };
}

export function parseTasks(content: string): Task[] {
  const lines = content.split('\n');
  const tasks: Task[] = [];

  for (let i = 0; i < lines.length; i++) {
    const match = lines[i].match(CHECKBOX_RE);
    if (!match) continue;

    const [, , marker, rawText] = match;
    const status = parseStatus(marker);
    const { prompt, tags } = extractTags(rawText);

    tasks.push({
      line: i + 1,
      rawText,
      prompt,
      status,
      cwd: tags.cwd,
      maxBudgetUsd: tags.budget ? Number(tags.budget) : undefined,
      maxTurns: tags.turns ? Number(tags.turns) : undefined,
      agent: tags.agent,
      retryCount: 0,
      tags,
    });
  }

  return tasks;
}
