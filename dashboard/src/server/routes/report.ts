import fs from 'node:fs';
import path from 'node:path';
import type { FastifyPluginAsync } from 'fastify';

export const reportRoute: FastifyPluginAsync = async (app) => {
  // GET /report — generate and return HTML report from project data
  app.get('/report', async (_req, reply) => {
    const { projectPath } = app.appState;
    if (!projectPath) {
      return reply.code(400).send({ error: 'No project path set' });
    }

    const sessionsPath = path.join(projectPath, '.claudebot', 'sessions.json');
    if (!fs.existsSync(sessionsPath)) {
      return reply.code(404).send({ error: 'No sessions data found' });
    }

    let sessions: Array<{
      taskTitle: string;
      status: string;
      durationMs: number;
      costUsd: number;
      engine: string;
      botName?: string;
      model?: string;
    }>;

    try {
      sessions = JSON.parse(fs.readFileSync(sessionsPath, 'utf-8'));
    } catch {
      return reply.code(500).send({ error: 'Failed to parse sessions data' });
    }

    const projectName = path.basename(projectPath);
    const generatedAt = new Date().toISOString();
    const totalCostUsd = sessions.reduce((sum, s) => sum + (s.costUsd || 0), 0);
    const totalDurationMs = sessions.reduce((sum, s) => sum + (s.durationMs || 0), 0);

    // Build tasks
    const tasks = sessions.map((s) => ({
      title: s.taskTitle || 'Untitled',
      status: (s.status === 'completed' ? 'completed' : s.status === 'failed' ? 'failed' : 'pending') as 'completed' | 'failed' | 'pending',
      durationMs: s.durationMs || 0,
      costUsd: s.costUsd || 0,
      botName: s.botName,
    }));

    // Build bot contributions
    const botMap = new Map<string, { completed: number; failed: number; costUsd: number; model?: string }>();
    for (const s of sessions) {
      const name = s.botName || 'default';
      const existing = botMap.get(name) || { completed: 0, failed: 0, costUsd: 0, model: s.model };
      if (s.status === 'completed') existing.completed++;
      else if (s.status === 'failed') existing.failed++;
      existing.costUsd += s.costUsd || 0;
      botMap.set(name, existing);
    }

    const bots = Array.from(botMap.entries()).map(([name, info]) => ({
      name,
      tasksCompleted: info.completed,
      tasksFailed: info.failed,
      costUsd: info.costUsd,
      model: info.model,
    }));

    // Read config for budget
    let budgetUsd: number | undefined;
    const configPath = path.join(projectPath, 'claudebot.config.json');
    try {
      if (fs.existsSync(configPath)) {
        const config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
        budgetUsd = config.maxTotalBudgetUsd;
      }
    } catch { /* ignore */ }

    // Generate HTML inline (avoiding cross-package import)
    const html = buildReportHtml({
      projectName,
      generatedAt,
      totalDurationMs,
      totalCostUsd,
      budgetUsd,
      tasks,
      bots,
      modifiedFiles: [],
    });

    reply.type('text/html').send(html);
  });
};

// Inline report HTML builder for dashboard (avoids importing from main package)
interface InlineReportData {
  projectName: string;
  generatedAt: string;
  totalDurationMs: number;
  totalCostUsd: number;
  budgetUsd?: number;
  tasks: Array<{ title: string; status: string; durationMs: number; costUsd: number; botName?: string }>;
  bots: Array<{ name: string; tasksCompleted: number; tasksFailed: number; costUsd: number; model?: string }>;
  modifiedFiles: string[];
}

function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function buildReportHtml(data: InlineReportData): string {
  const totalTasks = data.tasks.length;
  const completedTasks = data.tasks.filter(t => t.status === 'completed').length;
  const failedTasks = data.tasks.filter(t => t.status === 'failed').length;
  const successRate = totalTasks > 0 ? ((completedTasks / totalTasks) * 100).toFixed(1) : '0.0';
  const durationMin = (data.totalDurationMs / 60000).toFixed(1);
  const budgetUsed = data.budgetUsd ? ((data.totalCostUsd / data.budgetUsd) * 100).toFixed(1) : null;

  const taskRows = data.tasks.map(t => `<tr><td>${esc(t.title)}</td><td><span class="badge badge-${t.status}">${t.status}</span></td><td>${(t.durationMs/1000).toFixed(1)}s</td><td>$${t.costUsd.toFixed(4)}</td><td>${esc(t.botName??'-')}</td></tr>`).join('');
  const botRows = data.bots.map(b => `<tr><td>${esc(b.name)}</td><td>${esc(b.model??'-')}</td><td>${b.tasksCompleted}</td><td>${b.tasksFailed}</td><td>$${b.costUsd.toFixed(4)}</td><td>${totalTasks>0?((b.tasksCompleted/totalTasks)*100).toFixed(0):0}%</td></tr>`).join('');

  return `<!DOCTYPE html>
<html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"><title>ClaudeBot Report — ${esc(data.projectName)}</title>
<style>:root{--bg:#0d1117;--surface:#161b22;--elevated:#21262d;--border:#30363d;--text:#e6edf3;--muted:#8b949e;--success:#3fb950;--danger:#f85149;--info:#58a6ff;--purple:#a371f7}*{box-sizing:border-box;margin:0;padding:0}body{background:var(--bg);color:var(--text);font-family:system-ui,-apple-system,sans-serif;padding:2rem;max-width:960px;margin:0 auto}h1{font-size:1.5rem;margin-bottom:.25rem}h2{font-size:1.1rem;margin-bottom:1rem;color:var(--info)}.meta{color:var(--muted);font-size:.8rem;margin-bottom:2rem}.section{background:var(--surface);border:1px solid var(--border);border-radius:8px;padding:1.25rem;margin-bottom:1.25rem}.cards{display:grid;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:.75rem}.card{background:var(--elevated);border-radius:6px;padding:1rem;text-align:center}.card-value{font-size:1.5rem;font-weight:700}.card-label{font-size:.75rem;color:var(--muted);margin-top:.25rem}table{width:100%;border-collapse:collapse;font-size:.8rem}th,td{padding:.5rem .75rem;text-align:left;border-bottom:1px solid var(--border)}th{color:var(--muted);font-weight:600;font-size:.7rem;text-transform:uppercase;letter-spacing:.04em}.badge{padding:2px 8px;border-radius:10px;font-size:.7rem;font-weight:600}.badge-completed{background:rgba(63,185,80,.15);color:var(--success)}.badge-failed{background:rgba(248,81,73,.15);color:var(--danger)}.badge-pending{background:rgba(139,148,158,.15);color:var(--muted)}.cost-bar{height:8px;background:var(--elevated);border-radius:4px;overflow:hidden;margin-top:.5rem}.cost-bar-fill{height:100%;border-radius:4px}footer{text-align:center;color:var(--muted);font-size:.7rem;margin-top:2rem;padding-top:1rem;border-top:1px solid var(--border)}</style>
</head><body>
<h1>ClaudeBot Report</h1><div class="meta">${esc(data.projectName)} &mdash; ${esc(data.generatedAt)}</div>
<div class="section"><h2>Summary</h2><div class="cards">
<div class="card"><div class="card-value">${totalTasks}</div><div class="card-label">Total Tasks</div></div>
<div class="card"><div class="card-value" style="color:var(--success)">${completedTasks}</div><div class="card-label">Completed</div></div>
<div class="card"><div class="card-value" style="color:var(--danger)">${failedTasks}</div><div class="card-label">Failed</div></div>
<div class="card"><div class="card-value">${successRate}%</div><div class="card-label">Success Rate</div></div>
<div class="card"><div class="card-value">${durationMin}m</div><div class="card-label">Duration</div></div>
<div class="card"><div class="card-value" style="color:var(--purple)">$${data.totalCostUsd.toFixed(4)}</div><div class="card-label">Total Cost</div></div>
</div>${budgetUsed!==null?`<div style="margin-top:1rem"><div style="display:flex;justify-content:space-between;font-size:.75rem;color:var(--muted)"><span>Budget Usage</span><span>${budgetUsed}%</span></div><div class="cost-bar"><div class="cost-bar-fill" style="width:${Math.min(Number(budgetUsed),100)}%;background:${Number(budgetUsed)>90?'var(--danger)':Number(budgetUsed)>70?'#d29922':'var(--success)'}"></div></div></div>`:''}</div>
<div class="section"><h2>Tasks</h2><table><thead><tr><th>Task</th><th>Status</th><th>Duration</th><th>Cost</th><th>Bot</th></tr></thead><tbody>${taskRows}</tbody></table></div>
<div class="section"><h2>Bot Contributions</h2><table><thead><tr><th>Bot</th><th>Model</th><th>Completed</th><th>Failed</th><th>Cost</th><th>Contribution</th></tr></thead><tbody>${botRows}</tbody></table></div>
${data.modifiedFiles.length>0?`<div class="section"><h2>Modified Files (${data.modifiedFiles.length})</h2><ul>${data.modifiedFiles.map(f=>`<li><code>${esc(f)}</code></li>`).join('')}</ul></div>`:''}
<footer>Generated by ClaudeBot &mdash; ${esc(data.generatedAt)}</footer>
</body></html>`;
}
