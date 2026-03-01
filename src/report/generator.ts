import fs from 'node:fs';
import path from 'node:path';

export interface ReportData {
  projectName: string;
  generatedAt: string;
  totalDurationMs: number;
  totalCostUsd: number;
  budgetUsd?: number;
  tasks: ReportTask[];
  bots: ReportBot[];
  modifiedFiles: string[];
  qaResults?: { passed: number; failed: number; skipped: number };
}

export interface ReportTask {
  title: string;
  status: 'completed' | 'failed' | 'pending';
  durationMs: number;
  costUsd: number;
  botName?: string;
}

export interface ReportBot {
  name: string;
  tasksCompleted: number;
  tasksFailed: number;
  costUsd: number;
  model?: string;
}

/**
 * Generate a standalone HTML report for a completed swarm run.
 */
export function generateHtmlReport(data: ReportData): string {
  const totalTasks = data.tasks.length;
  const completedTasks = data.tasks.filter(t => t.status === 'completed').length;
  const failedTasks = data.tasks.filter(t => t.status === 'failed').length;
  const successRate = totalTasks > 0 ? ((completedTasks / totalTasks) * 100).toFixed(1) : '0.0';
  const durationMin = (data.totalDurationMs / 60000).toFixed(1);
  const budgetUsed = data.budgetUsd
    ? ((data.totalCostUsd / data.budgetUsd) * 100).toFixed(1)
    : null;

  const taskRows = data.tasks
    .map(
      (t) => `
    <tr>
      <td>${esc(t.title)}</td>
      <td><span class="badge badge-${t.status}">${t.status}</span></td>
      <td>${(t.durationMs / 1000).toFixed(1)}s</td>
      <td>$${t.costUsd.toFixed(4)}</td>
      <td>${esc(t.botName ?? '-')}</td>
    </tr>`,
    )
    .join('\n');

  const botRows = data.bots
    .map(
      (b) => `
    <tr>
      <td>${esc(b.name)}</td>
      <td>${esc(b.model ?? '-')}</td>
      <td>${b.tasksCompleted}</td>
      <td>${b.tasksFailed}</td>
      <td>$${b.costUsd.toFixed(4)}</td>
      <td>${totalTasks > 0 ? ((b.tasksCompleted / totalTasks) * 100).toFixed(0) : 0}%</td>
    </tr>`,
    )
    .join('\n');

  const fileList = data.modifiedFiles
    .map((f) => `<li><code>${esc(f)}</code></li>`)
    .join('\n');

  const qaSection = data.qaResults
    ? `
    <div class="section">
      <h2>QA Results</h2>
      <div class="cards">
        <div class="card"><div class="card-value" style="color:#3fb950">${data.qaResults.passed}</div><div class="card-label">Passed</div></div>
        <div class="card"><div class="card-value" style="color:#f85149">${data.qaResults.failed}</div><div class="card-label">Failed</div></div>
        <div class="card"><div class="card-value" style="color:#8b949e">${data.qaResults.skipped}</div><div class="card-label">Skipped</div></div>
      </div>
    </div>`
    : '';

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>ClaudeBot Report — ${esc(data.projectName)}</title>
<style>
  :root { --bg: #0d1117; --surface: #161b22; --elevated: #21262d; --border: #30363d; --text: #e6edf3; --muted: #8b949e; --success: #3fb950; --danger: #f85149; --info: #58a6ff; --purple: #a371f7; }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { background: var(--bg); color: var(--text); font-family: system-ui, -apple-system, sans-serif; padding: 2rem; max-width: 960px; margin: 0 auto; }
  h1 { font-size: 1.5rem; margin-bottom: 0.25rem; }
  h2 { font-size: 1.1rem; margin-bottom: 1rem; color: var(--info); }
  .meta { color: var(--muted); font-size: 0.8rem; margin-bottom: 2rem; }
  .section { background: var(--surface); border: 1px solid var(--border); border-radius: 8px; padding: 1.25rem; margin-bottom: 1.25rem; }
  .cards { display: grid; grid-template-columns: repeat(auto-fit, minmax(140px, 1fr)); gap: 0.75rem; }
  .card { background: var(--elevated); border-radius: 6px; padding: 1rem; text-align: center; }
  .card-value { font-size: 1.5rem; font-weight: 700; }
  .card-label { font-size: 0.75rem; color: var(--muted); margin-top: 0.25rem; }
  table { width: 100%; border-collapse: collapse; font-size: 0.8rem; }
  th, td { padding: 0.5rem 0.75rem; text-align: left; border-bottom: 1px solid var(--border); }
  th { color: var(--muted); font-weight: 600; font-size: 0.7rem; text-transform: uppercase; letter-spacing: 0.04em; }
  .badge { padding: 2px 8px; border-radius: 10px; font-size: 0.7rem; font-weight: 600; }
  .badge-completed { background: rgba(63,185,80,0.15); color: var(--success); }
  .badge-failed { background: rgba(248,81,73,0.15); color: var(--danger); }
  .badge-pending { background: rgba(139,148,158,0.15); color: var(--muted); }
  ul { list-style: none; padding: 0; }
  ul li { padding: 0.3rem 0; font-size: 0.8rem; color: var(--muted); }
  ul li code { color: var(--text); font-size: 0.75rem; background: var(--elevated); padding: 2px 6px; border-radius: 3px; }
  .cost-bar { height: 8px; background: var(--elevated); border-radius: 4px; overflow: hidden; margin-top: 0.5rem; }
  .cost-bar-fill { height: 100%; border-radius: 4px; transition: width 0.5s; }
  footer { text-align: center; color: var(--muted); font-size: 0.7rem; margin-top: 2rem; padding-top: 1rem; border-top: 1px solid var(--border); }
</style>
</head>
<body>
  <h1>ClaudeBot Report</h1>
  <div class="meta">${esc(data.projectName)} &mdash; ${esc(data.generatedAt)}</div>

  <div class="section">
    <h2>Summary</h2>
    <div class="cards">
      <div class="card"><div class="card-value">${totalTasks}</div><div class="card-label">Total Tasks</div></div>
      <div class="card"><div class="card-value" style="color:var(--success)">${completedTasks}</div><div class="card-label">Completed</div></div>
      <div class="card"><div class="card-value" style="color:var(--danger)">${failedTasks}</div><div class="card-label">Failed</div></div>
      <div class="card"><div class="card-value">${successRate}%</div><div class="card-label">Success Rate</div></div>
      <div class="card"><div class="card-value">${durationMin}m</div><div class="card-label">Duration</div></div>
      <div class="card"><div class="card-value" style="color:var(--purple)">$${data.totalCostUsd.toFixed(4)}</div><div class="card-label">Total Cost</div></div>
    </div>
    ${
      budgetUsed !== null
        ? `<div style="margin-top:1rem"><div style="display:flex;justify-content:space-between;font-size:0.75rem;color:var(--muted)"><span>Budget Usage</span><span>${budgetUsed}%</span></div><div class="cost-bar"><div class="cost-bar-fill" style="width:${Math.min(Number(budgetUsed), 100)}%;background:${Number(budgetUsed) > 90 ? 'var(--danger)' : Number(budgetUsed) > 70 ? 'var(--warning, #d29922)' : 'var(--success)'}"></div></div></div>`
        : ''
    }
  </div>

  <div class="section">
    <h2>Tasks</h2>
    <table>
      <thead><tr><th>Task</th><th>Status</th><th>Duration</th><th>Cost</th><th>Bot</th></tr></thead>
      <tbody>${taskRows}</tbody>
    </table>
  </div>

  <div class="section">
    <h2>Bot Contributions</h2>
    <table>
      <thead><tr><th>Bot</th><th>Model</th><th>Completed</th><th>Failed</th><th>Cost</th><th>Contribution</th></tr></thead>
      <tbody>${botRows}</tbody>
    </table>
  </div>

  ${
    data.modifiedFiles.length > 0
      ? `<div class="section"><h2>Modified Files (${data.modifiedFiles.length})</h2><ul>${fileList}</ul></div>`
      : ''
  }

  ${qaSection}

  <footer>Generated by ClaudeBot &mdash; ${esc(data.generatedAt)}</footer>
</body>
</html>`;
}

function esc(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/**
 * Save an HTML report to disk.
 */
export function saveReport(data: ReportData, outputDir: string): string {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const filename = `claudebot-report-${timestamp}.html`;
  const outputPath = path.join(outputDir, filename);

  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  const html = generateHtmlReport(data);
  fs.writeFileSync(outputPath, html, 'utf-8');

  return outputPath;
}
