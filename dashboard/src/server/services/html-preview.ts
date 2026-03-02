/**
 * html-preview.ts — Template-based HTML generation for Decision Cards.
 * Pure functions. No I/O, no external dependencies.
 */
import type { HtmlTab } from '../../shared/api-types.js';

// ─── Shared Styles ──────────────────────────────────────────────────────────

const STYLES = `<style>
  .hp{font-family:system-ui,-apple-system,sans-serif;font-size:13px;color:#1f2328;line-height:1.5}
  .hp h3{margin:0 0 14px;font-size:15px;font-weight:600;color:#0d1117}
  .hp .sec{font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.05em;color:#57606a;margin:18px 0 8px}
  .hp ul,.hp ol{margin:0;padding-left:18px}
  .hp li{margin:4px 0;font-size:13px}
  .hp .box{background:#f6f8fa;border:1px solid #d0d7de;border-radius:6px;padding:10px 14px;margin:8px 0}
  .hp .badge{display:inline-block;padding:2px 8px;border-radius:12px;font-size:11px;font-weight:500}
  .hp .b-blue{background:#ddf4ff;color:#0969da}
  .hp .b-green{background:#dafbe1;color:#1a7f37}
  .hp .b-purple{background:#fbefff;color:#8250df}
  .hp .b-amber{background:#fff8c5;color:#9a6700}
  .hp .arch{display:flex;gap:8px;flex-wrap:wrap;margin:10px 0}
  .hp .arch-box{flex:1;min-width:100px;border:1.5px solid #d0d7de;border-radius:6px;padding:10px 12px;text-align:center;font-size:12px;font-weight:500;background:#fff}
  .hp .arch-arrow{align-self:center;color:#57606a;font-size:14px}
  .hp .flow{display:flex;align-items:flex-start;gap:10px;margin:6px 0}
  .hp .flow-n{width:22px;height:22px;border-radius:50%;background:#0969da;color:#fff;font-size:11px;display:flex;align-items:center;justify-content:center;flex-shrink:0}
  .hp .flow-t{font-size:13px;padding-top:2px}
  .hp .check{color:#1a7f37;margin-right:4px}
  .hp table{width:100%;border-collapse:collapse;font-size:12px;margin:8px 0}
  .hp th{background:#f6f8fa;text-align:left;padding:6px 10px;border:1px solid #d0d7de;font-weight:600}
  .hp td{padding:5px 10px;border:1px solid #d0d7de}
  .hp tr:nth-child(even) td{background:#f6f8fa}
  .hp .cb{display:inline-block;width:14px;height:14px;border:1.5px solid #d0d7de;border-radius:3px;vertical-align:middle;margin-right:6px}
</style>`;

// ─── Helpers ─────────────────────────────────────────────────────────────────

function esc(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function truncate(s: string, max: number): string {
  return s.length > max ? s.substring(0, max) + '...' : s;
}

// ─── Prediction HTML ─────────────────────────────────────────────────────────

export interface PredictionParams {
  topic: string;
  requirements: string[];
  model: string;
  budget: string;
}

export function buildPredictionHtml(params: PredictionParams): string {
  const { topic, requirements, model, budget } = params;

  // Architecture boxes — derive from topic or use defaults
  const archComponents = ['Frontend', 'Backend', 'Storage'];
  const archHtml = archComponents
    .flatMap((c, i) =>
      i < archComponents.length - 1
        ? [`<div class="arch-box">${c}</div>`, `<div class="arch-arrow">\u2192</div>`]
        : [`<div class="arch-box">${c}</div>`],
    )
    .join('');

  // User flow steps
  const flowSteps = requirements.length > 0
    ? requirements.slice(0, 5)
    : ['프로젝트 분석', '문서 생성', '코드 구현', '리뷰 및 검증'];
  const flowHtml = flowSteps
    .map(
      (step, i) =>
        `<div class="flow"><div class="flow-n">${i + 1}</div><div class="flow-t">${esc(truncate(step, 80))}</div></div>`,
    )
    .join('');

  // Completion criteria
  const criteria = [
    '개발 문서 3종 (PRD, TechSpec, Tasks)',
    '구현 코드',
    '리뷰 보고서',
  ];
  const criteriaHtml = criteria
    .map((c) => `<li><span class="check">\u2713</span>${esc(c)}</li>`)
    .join('');

  // Requirements list
  const reqHtml =
    requirements.length > 0
      ? requirements
          .slice(0, 6)
          .map((r) => `<li>${esc(truncate(r, 90))}</li>`)
          .join('')
      : '<li>대화에서 수집된 요구사항 없음</li>';

  return `${STYLES}
<div class="hp">
  <h3>${esc(topic)}</h3>

  <div class="sec">Architecture</div>
  <div class="arch">${archHtml}</div>

  <div class="sec">User Flow</div>
  ${flowHtml}

  <div class="sec">Requirements</div>
  <ul>${reqHtml}</ul>

  <div class="sec">Completion Criteria</div>
  <ul>${criteriaHtml}</ul>

  <div class="sec">Scope</div>
  <div class="box">
    <span class="badge b-blue">${esc(model)}</span>
    <span class="badge b-purple" style="margin-left:6px">Agent SDK</span>
    ${budget !== '미설정' ? `<span class="badge b-green" style="margin-left:6px">Budget: ${esc(budget)}</span>` : ''}
  </div>
</div>`;
}

// ─── Documentation Tabs ─────────────────────────────────────────────────────

export interface DocumentationParams {
  topic: string;
  requirements: string[];
}

export function buildDocumentationTabs(params: DocumentationParams): HtmlTab[] {
  const { topic, requirements } = params;

  const prdHtml = buildPrdTab(topic, requirements);
  const techSpecHtml = buildTechSpecTab(topic);
  const tasksHtml = buildTasksTab(topic, requirements);

  return [
    { label: 'PRD', html: prdHtml },
    { label: 'TechSpec', html: techSpecHtml },
    { label: 'Tasks', html: tasksHtml },
  ];
}

function buildPrdTab(topic: string, requirements: string[]): string {
  const storyItems =
    requirements.length > 0
      ? requirements
          .slice(0, 5)
          .map((r, i) => `<li><strong>US-${i + 1}:</strong> ${esc(truncate(r, 80))}</li>`)
          .join('')
      : '<li>대화 분석 후 자동 생성</li>';

  return `${STYLES}
<div class="hp">
  <h3>PRD \u2014 ${esc(topic)}</h3>

  <div class="sec">목표</div>
  <div class="box">${esc(topic)}</div>

  <div class="sec">User Stories</div>
  <ul>${storyItems}</ul>

  <div class="sec">Non-Functional Requirements</div>
  <ul>
    <li>응답 시간 &lt; 500ms (주요 작업)</li>
    <li>Agent SDK 기반 실행</li>
    <li>오류 발생 시 명확한 피드백</li>
  </ul>

  <div class="sec">Success Metrics</div>
  <ul>
    <li>모든 Tasks 체크박스 완료</li>
    <li>Reviewer 승인</li>
    <li>예산 한도 내 완료</li>
  </ul>
</div>`;
}

function buildTechSpecTab(topic: string): string {
  const endpoints = [
    ['POST', '/api/project', '프로젝트 경로 설정'],
    ['GET', '/api/chat/messages', '채팅 이력 조회'],
    ['POST', '/api/chat/send', '메시지 전송'],
    ['POST', '/api/chat/decision', 'Decision 응답'],
    ['GET', '/api/chat/workflow', '워크플로우 상태'],
    ['WS', '/api/chat/ws', '실시간 채팅'],
  ];
  const rows = endpoints
    .map(
      ([method, path, desc]) =>
        `<tr><td><code>${method}</code></td><td><code>${path}</code></td><td>${desc}</td></tr>`,
    )
    .join('');

  return `${STYLES}
<div class="hp">
  <h3>TechSpec \u2014 ${esc(topic)}</h3>

  <div class="sec">Stack</div>
  <div class="arch">
    <div class="arch-box">TypeScript</div>
    <div class="arch-arrow">+</div>
    <div class="arch-box">Fastify 5</div>
    <div class="arch-arrow">+</div>
    <div class="arch-box">React 19</div>
    <div class="arch-arrow">+</div>
    <div class="arch-box">Agent SDK</div>
  </div>

  <div class="sec">API Endpoints</div>
  <table>
    <thead><tr><th>Method</th><th>Path</th><th>Description</th></tr></thead>
    <tbody>${rows}</tbody>
  </table>

  <div class="sec">Data Schema</div>
  <div class="box">
    <code>.claudebot/chat.json</code> \u2014 채팅 이력 + 워크플로우 상태<br>
    <code>claudebot.config.json</code> \u2014 모델, 예산, 권한 설정
  </div>

  <div class="sec">Constraints</div>
  <ul>
    <li>ESM only (<code>type: module</code>)</li>
    <li>DB 없음 \u2014 파일 기반 영속화</li>
    <li>CLI 없음 \u2014 Dashboard 전용</li>
  </ul>
</div>`;
}

// ─── Review HTML ────────────────────────────────────────────────────────────

export interface ReviewParams {
  topic: string;
  tasksCompleted: number;
  tasksFailed: number;
  totalCostUsd: number;
  durationMs: number;
  modifiedFiles: string[];
  botSummaries: Array<{ name: string; tasks: number; cost: number; status: string }>;
  goals: string[];
  failureReasons?: Array<{ botName: string; task: string; reason: string; errorCode?: string }>;
}

export function buildReviewHtml(params: ReviewParams): string {
  const {
    topic, tasksCompleted, tasksFailed, totalCostUsd,
    durationMs, modifiedFiles, botSummaries, goals, failureReasons = [],
  } = params;

  const total = tasksCompleted + tasksFailed;
  const successRate = total > 0 ? Math.round((tasksCompleted / total) * 100) : 0;
  const durationStr = durationMs < 60_000
    ? `${Math.round(durationMs / 1000)}초`
    : `${Math.floor(durationMs / 60_000)}분 ${Math.round((durationMs % 60_000) / 1000)}초`;

  const statusBadge = tasksFailed === 0
    ? '<span class="badge b-green">All Passed</span>'
    : `<span class="badge b-amber">${tasksFailed} Failed</span>`;

  // Bot summary table
  const botRows = botSummaries.length > 0
    ? botSummaries.map(b =>
        `<tr><td>${esc(b.name)}</td><td>${b.tasks}</td><td>$${b.cost.toFixed(4)}</td><td>${esc(b.status)}</td></tr>`,
      ).join('')
    : '<tr><td colspan="4">시뮬레이션 모드 (SDK 미연결)</td></tr>';

  // Goal achievement
  const goalItems = goals.length > 0
    ? goals.map(g => `<li><span class="check">\u2713</span>${esc(truncate(g, 80))}</li>`).join('')
    : '<li>대화에서 설정된 목표 없음</li>';

  // Modified files list
  const fileItems = modifiedFiles.length > 0
    ? modifiedFiles.slice(0, 10).map(f => `<li><code>${esc(f)}</code></li>`).join('')
    : '<li>변경된 파일 없음</li>';

  const failureItems = failureReasons.length > 0
    ? failureReasons
        .slice(0, 8)
        .map((f) => {
          const code = f.errorCode ? `<span class="badge b-amber" style="margin-right:6px">${esc(f.errorCode)}</span>` : '';
          return `<li>${code}<strong>${esc(f.botName)}</strong> \u2014 ${esc(truncate(f.reason, 140))}<br><span style="color:#57606a">Task: ${esc(truncate(f.task, 90))}</span></li>`;
        })
        .join('')
    : '';

  return `${STYLES}
<div class="hp">
  <h3>Review Report \u2014 ${esc(topic)}</h3>

  <div class="sec">Summary</div>
  <div class="box">
    ${statusBadge}
    <span class="badge b-blue" style="margin-left:6px">${successRate}% 성공률</span>
    <span class="badge b-purple" style="margin-left:6px">$${totalCostUsd.toFixed(4)}</span>
    <span class="badge b-amber" style="margin-left:6px">${durationStr}</span>
  </div>

  <div class="sec">Tasks</div>
  <div class="box">
    완료: <strong>${tasksCompleted}</strong> / 실패: <strong>${tasksFailed}</strong> / 합계: <strong>${total}</strong>
  </div>

  ${failureItems ? `<div class="sec">Failure Reasons</div><ul>${failureItems}</ul>` : ''}

  <div class="sec">Bot Team</div>
  <table>
    <thead><tr><th>Bot</th><th>Tasks</th><th>Cost</th><th>Status</th></tr></thead>
    <tbody>${botRows}</tbody>
  </table>

  <div class="sec">Goal Achievement</div>
  <ul>${goalItems}</ul>

  <div class="sec">Modified Files</div>
  <ul>${fileItems}</ul>
</div>`;
}

// ─── Tasks Tab (internal) ───────────────────────────────────────────────────

function buildTasksTab(topic: string, requirements: string[]): string {
  const defaultTasks = [
    'PRD / TechSpec / Tasks 문서 생성',
    '핵심 기능 구현',
    '단위 테스트 작성',
    '통합 테스트 및 검증',
    'Reviewer 최종 승인',
  ];
  const tasks = requirements.length > 0 ? requirements.slice(0, 6) : defaultTasks;

  const taskItems = tasks
    .map(
      (t, i) =>
        `<li style="margin:5px 0"><span class="cb"></span> T-${String(i + 1).padStart(2, '0')}: ${esc(truncate(t, 80))}</li>`,
    )
    .join('');

  return `${STYLES}
<div class="hp">
  <h3>Tasks \u2014 ${esc(topic)}</h3>

  <div class="sec">실행 목록</div>
  <ul style="list-style:none;padding:0">${taskItems}</ul>

  <div class="sec">Priority</div>
  <div class="box">
    <span class="badge b-green">P0</span> 핵심 기능 &nbsp;
    <span class="badge b-blue">P1</span> 개선 사항 &nbsp;
    <span class="badge b-amber">P2</span> 선택 사항
  </div>

  <div class="sec">실행 방법</div>
  <ul>
    <li>Doc Writer Bot \u2192 문서 3종 자동 생성</li>
    <li>Developer Bot \u2192 Tasks 순차 실행</li>
    <li>Reviewer Bot \u2192 완료 코드 검증</li>
  </ul>
</div>`;
}
