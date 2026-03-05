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

function formatDuration(ms: number): string {
  if (ms < 60_000) return `${Math.round(ms / 1000)}초`;
  const m = Math.floor(ms / 60_000);
  const s = Math.round((ms % 60_000) / 1000);
  return s > 0 ? `${m}분 ${s}초` : `${m}분`;
}

// ─── Prediction HTML ─────────────────────────────────────────────────────────

export interface PredictionParams {
  topic: string;
  requirements: string[];
  model: string;
  budget: string;
  architecture?: string[];
  userFlow?: string[];
  completionCriteria?: string[];
}

export function buildPredictionHtml(params: PredictionParams): string {
  const {
    topic,
    requirements,
    model,
    budget,
    architecture,
    userFlow,
    completionCriteria,
  } = params;

  // Architecture boxes — derive from topic or use defaults
  const archComponents = architecture && architecture.length > 0
    ? architecture.slice(0, 6)
    : ['Frontend', 'Backend', 'Storage'];
  const archHtml = archComponents
    .flatMap((c, i) =>
      i < archComponents.length - 1
        ? [`<div class="arch-box">${c}</div>`, `<div class="arch-arrow">\u2192</div>`]
        : [`<div class="arch-box">${c}</div>`],
    )
    .join('');

  // User flow steps
  const flowSteps = userFlow && userFlow.length > 0
    ? userFlow.slice(0, 6)
    : requirements.length > 0
    ? requirements.slice(0, 5)
    : ['프로젝트 분석', '문서 생성', '코드 구현', '리뷰 및 검증'];
  const flowHtml = flowSteps
    .map(
      (step, i) =>
        `<div class="flow"><div class="flow-n">${i + 1}</div><div class="flow-t">${esc(truncate(step, 80))}</div></div>`,
    )
    .join('');

  // Completion criteria
  const criteria = completionCriteria && completionCriteria.length > 0
    ? completionCriteria.slice(0, 6)
    : [
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

export interface PredictionArtifactParams {
  topic: string;
  requirements: string[];
  model: string;
  budget: string;
  architecture?: string[];
  userFlow?: string[];
  completionCriteria?: string[];
  scenarios?: string[];
}

/**
 * Standalone HTML artifact for external browser preview.
 * This is intentionally richer than inline DecisionCard HTML.
 */
export function buildPredictionArtifactHtml(params: PredictionArtifactParams): string {
  const {
    topic,
    requirements,
    model,
    budget,
    architecture,
    userFlow,
    completionCriteria,
    scenarios,
  } = params;

  const arch = (architecture && architecture.length > 0
    ? architecture
    : ['Client UI', 'API Gateway', 'Domain Service', 'Data Store', 'Observability']).slice(0, 6);

  const flows = (userFlow && userFlow.length > 0
    ? userFlow
    : requirements.length > 0
      ? requirements
      : ['요구사항 입력', '설계 확정', '구현', '검증']).slice(0, 6);

  const criteria = (completionCriteria && completionCriteria.length > 0
    ? completionCriteria
    : ['핵심 시나리오 동작', '성능/안정성 확인', '리뷰 승인']).slice(0, 8);

  const reqs = (requirements.length > 0
    ? requirements
    : ['핵심 기능 요구사항은 대화에서 확정']).slice(0, 8);

  const scenarioItems = (scenarios && scenarios.length > 0
    ? scenarios
    : [
      '사용자가 메인 화면에서 핵심 기능을 3클릭 이내로 실행한다.',
      '시스템이 실패 케이스를 안내하고 복구 경로를 제공한다.',
      '운영자는 로그/메트릭으로 상태를 즉시 파악한다.',
    ]).slice(0, 6);

  const archNodes = arch
    .map((item, idx) => `<div class="node"><span class="idx">${idx + 1}</span>${esc(item)}</div>`)
    .join('');

  const flowRows = flows
    .map((item, idx) => `<li><span>${idx + 1}</span><p>${esc(item)}</p></li>`)
    .join('');

  const reqRows = reqs.map((item) => `<li>${esc(item)}</li>`).join('');
  const criteriaRows = criteria.map((item) => `<li>${esc(item)}</li>`).join('');
  const scenarioRows = scenarioItems
    .map((item, idx) => `<article class="scenario"><h4>Scenario ${idx + 1}</h4><p>${esc(item)}</p></article>`)
    .join('');

  const dfdFrom = esc(arch[0] ?? 'User');
  const dfdP1 = esc(arch[1] ?? 'Process A');
  const dfdP2 = esc(arch[2] ?? 'Process B');
  const dfdStore = esc(arch[3] ?? 'Data Store');
  const dfdObs = esc(arch[4] ?? 'Monitoring');

  return `<!doctype html>
<html lang="ko">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Output Preview — ${esc(topic)}</title>
  <style>
    :root{
      --bg:#0b1020;--panel:#111831;--card:#182243;--text:#e8eefc;--muted:#9bb0da;
      --line:#355091;--acc:#79a9ff;--ok:#7be2b1;--warn:#ffd77f;
      --grid:linear-gradient(transparent 95%, rgba(121,169,255,.15) 95%),linear-gradient(90deg, transparent 95%, rgba(121,169,255,.15) 95%);
    }
    *{box-sizing:border-box}
    body{margin:0;font-family:ui-sans-serif,system-ui,-apple-system,Segoe UI,Roboto,sans-serif;color:var(--text);background:
      radial-gradient(circle at 20% 10%, #243e7a 0%, rgba(36,62,122,0) 35%),
      radial-gradient(circle at 80% 20%, #1e2c54 0%, rgba(30,44,84,0) 42%),
      var(--bg);}
    .wrap{max-width:1280px;margin:0 auto;padding:28px 24px 64px}
    .hero{display:grid;grid-template-columns:1.4fr 1fr;gap:20px;align-items:stretch}
    .panel{background:rgba(17,24,49,.9);border:1px solid var(--line);border-radius:16px;padding:18px}
    h1{margin:0 0 8px;font-size:26px;line-height:1.2}
    h2{margin:0 0 10px;font-size:17px}
    p{margin:0}
    .meta{display:flex;flex-wrap:wrap;gap:8px;margin-top:14px}
    .badge{font-size:12px;padding:4px 10px;border:1px solid var(--line);border-radius:999px;color:var(--muted)}
    .kpis{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px}
    .kpi{background:var(--card);border:1px solid var(--line);border-radius:12px;padding:12px}
    .kpi b{display:block;font-size:20px}
    .grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:16px;margin-top:16px}
    .box{background:var(--panel);border:1px solid var(--line);border-radius:14px;padding:16px}
    .mock{background:linear-gradient(180deg,#0f1630,#0d1327);border:1px solid var(--line);border-radius:12px;padding:10px;margin-top:12px}
    .mock .top{display:flex;gap:8px;margin-bottom:10px}
    .mock .dot{width:10px;height:10px;border-radius:50%;background:#486ab5}
    .mock .columns{display:grid;grid-template-columns:220px 1fr;gap:12px}
    .mock .nav,.mock .main{border:1px solid #2e4580;border-radius:10px;padding:10px;background:#121b38}
    .mock ul{margin:8px 0 0;padding-left:18px}
    .mock li{margin:5px 0;color:#c6d6fb}
    .arch{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px}
    .node{border:1px solid var(--line);border-radius:10px;padding:10px;background:#13204a;min-height:72px}
    .idx{display:inline-block;font-size:10px;color:var(--muted);border:1px solid var(--line);border-radius:999px;padding:1px 6px;margin-bottom:7px}
    .flow{margin:0;padding:0;list-style:none;display:grid;gap:10px}
    .flow li{display:grid;grid-template-columns:28px 1fr;gap:10px;align-items:flex-start}
    .flow span{width:28px;height:28px;border-radius:50%;display:grid;place-items:center;background:#25458a;color:#fff;font-weight:700}
    .flow p{margin-top:2px}
    .list{margin:8px 0 0;padding-left:18px}
    .list li{margin:6px 0;color:#d4e1ff}
    .scenario-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px}
    .scenario{background:#14204a;border:1px solid var(--line);border-radius:10px;padding:10px}
    .scenario h4{margin:0 0 6px;font-size:12px;color:var(--acc)}
    .scenario p{font-size:13px;line-height:1.45;color:#d8e4ff}
    .dfd{background:#0d1736;border:1px solid var(--line);border-radius:12px;padding:8px}
    .footer{margin-top:16px;font-size:12px;color:var(--muted)}
    @media (max-width: 1024px){
      .hero,.grid{grid-template-columns:1fr}
      .mock .columns{grid-template-columns:1fr}
      .arch{grid-template-columns:repeat(2,minmax(0,1fr))}
      .scenario-grid{grid-template-columns:1fr}
    }
  </style>
</head>
<body>
  <main class="wrap">
    <section class="hero">
      <article class="panel">
        <h1>${esc(topic)}</h1>
        <p style="color:var(--muted)">최종 결과물의 예상 형태를 시각화한 Output Preview입니다. 승인 전 UX/구조/데이터 흐름을 검토하세요.</p>
        <div class="meta">
          <span class="badge">Model: ${esc(model)}</span>
          <span class="badge">Budget: ${esc(budget)}</span>
          <span class="badge">Artifact: External HTML</span>
        </div>
      </article>
      <aside class="panel kpis">
        <div class="kpi"><small style="color:var(--muted)">요구사항</small><b>${reqs.length}</b></div>
        <div class="kpi"><small style="color:var(--muted)">사용 시나리오</small><b>${scenarioItems.length}</b></div>
        <div class="kpi"><small style="color:var(--muted)">아키텍처 노드</small><b>${arch.length}</b></div>
        <div class="kpi"><small style="color:var(--muted)">완료 기준</small><b>${criteria.length}</b></div>
      </aside>
    </section>

    <section class="grid">
      <article class="box">
        <h2>1) 예상 UI/UX</h2>
        <p style="color:var(--muted)">실사용 화면의 레이아웃/정보구조를 모사한 프리뷰입니다.</p>
        <div class="mock">
          <div class="top"><span class="dot"></span><span class="dot"></span><span class="dot"></span></div>
          <div class="columns">
            <div class="nav">
              <strong style="font-size:12px;color:var(--acc)">Navigation</strong>
              <ul>${reqs.slice(0, 5).map((r) => `<li>${esc(truncate(r, 36))}</li>`).join('')}</ul>
            </div>
            <div class="main">
              <strong style="font-size:12px;color:var(--ok)">Main Workspace</strong>
              <ul>${flows.slice(0, 4).map((f, idx) => `<li>Step ${idx + 1}: ${esc(truncate(f, 54))}</li>`).join('')}</ul>
            </div>
          </div>
        </div>
      </article>

      <article class="box">
        <h2>2) 아키텍처 맵</h2>
        <p style="color:var(--muted)">핵심 컴포넌트 의존 관계를 요약합니다.</p>
        <div class="arch">${archNodes}</div>
      </article>

      <article class="box">
        <h2>3) DFD (Data Flow Diagram)</h2>
        <p style="color:var(--muted)">외부 엔티티, 처리 프로세스, 데이터 저장소 흐름입니다.</p>
        <div class="dfd">
          <svg viewBox="0 0 860 300" width="100%" height="240" xmlns="http://www.w3.org/2000/svg">
            <defs>
              <marker id="arrow" markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto">
                <path d="M0,0 L8,4 L0,8 Z" fill="#79a9ff"/>
              </marker>
            </defs>
            <rect x="20" y="100" width="150" height="80" rx="10" fill="#12214b" stroke="#3b5aa3"/>
            <text x="95" y="145" fill="#dbe7ff" font-size="14" text-anchor="middle">${dfdFrom}</text>

            <circle cx="320" cy="140" r="55" fill="#19306a" stroke="#5a83da" />
            <text x="320" y="137" fill="#ffffff" font-size="13" text-anchor="middle">P1</text>
            <text x="320" y="154" fill="#d6e4ff" font-size="12" text-anchor="middle">${dfdP1}</text>

            <circle cx="510" cy="140" r="55" fill="#19306a" stroke="#5a83da" />
            <text x="510" y="137" fill="#ffffff" font-size="13" text-anchor="middle">P2</text>
            <text x="510" y="154" fill="#d6e4ff" font-size="12" text-anchor="middle">${dfdP2}</text>

            <rect x="650" y="95" width="170" height="90" rx="10" fill="#15254f" stroke="#3b5aa3"/>
            <text x="735" y="130" fill="#ffffff" font-size="13" text-anchor="middle">Data Store</text>
            <text x="735" y="150" fill="#d6e4ff" font-size="12" text-anchor="middle">${dfdStore}</text>

            <rect x="650" y="208" width="170" height="60" rx="10" fill="#11213f" stroke="#3b5aa3"/>
            <text x="735" y="244" fill="#d6e4ff" font-size="12" text-anchor="middle">${dfdObs}</text>

            <line x1="170" y1="140" x2="260" y2="140" stroke="#79a9ff" stroke-width="2.5" marker-end="url(#arrow)"/>
            <line x1="375" y1="140" x2="455" y2="140" stroke="#79a9ff" stroke-width="2.5" marker-end="url(#arrow)"/>
            <line x1="565" y1="140" x2="650" y2="140" stroke="#79a9ff" stroke-width="2.5" marker-end="url(#arrow)"/>
            <line x1="735" y1="185" x2="735" y2="208" stroke="#79a9ff" stroke-width="2.5" marker-end="url(#arrow)"/>
          </svg>
        </div>
      </article>

      <article class="box">
        <h2>4) 사용 시나리오</h2>
        <div class="scenario-grid">${scenarioRows}</div>
      </article>

      <article class="box">
        <h2>5) 사용자 흐름</h2>
        <ol class="flow">${flowRows}</ol>
      </article>

      <article class="box">
        <h2>6) 완료 기준 / 범위</h2>
        <h3 style="font-size:13px;color:var(--acc);margin:10px 0 4px">MVP Requirements</h3>
        <ul class="list">${reqRows}</ul>
        <h3 style="font-size:13px;color:var(--ok);margin:14px 0 4px">Definition of Done</h3>
        <ul class="list">${criteriaRows}</ul>
      </article>
    </section>

    <p class="footer">Generated Preview Artifact • Opened via external browser link</p>
  </main>
</body>
</html>`;
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

// ─── Review Artifact (standalone HTML) ───────────────────────────────────────

export interface PredictionSnapshot {
  requirements: string[];
  userFlow: string[];
  completionCriteria: string[];
  architecture: string[];
}

export interface RequirementCheckResult {
  text: string;
  status: 'done' | 'partial' | 'not-done';
  evidence?: string;
}

export interface ReviewArtifactParams {
  topic: string;
  tasksCompleted: number;
  tasksFailed: number;
  totalCostUsd: number;
  durationMs: number;
  modifiedFiles: string[];
  botSummaries: Array<{ name: string; tasks: number; cost: number; status: string }>;
  failureReasons: Array<{ botName: string; task: string; reason: string; errorCode?: string }>;
  prediction: PredictionSnapshot | null;
  requirementResults: RequirementCheckResult[];
  reviewerText: string;
  achievementRate: number;
}

export function buildReviewArtifactHtml(params: ReviewArtifactParams): string {
  const {
    topic, tasksCompleted, tasksFailed, totalCostUsd, durationMs,
    modifiedFiles, botSummaries, failureReasons, prediction,
    requirementResults, reviewerText, achievementRate,
  } = params;

  const total = tasksCompleted + tasksFailed;
  const successRate = total > 0 ? Math.round((tasksCompleted / total) * 100) : 0;
  const duration = formatDuration(durationMs);

  // Section 1: Requirement cross-reference table
  const reqRows = requirementResults.length > 0
    ? requirementResults.map((r, i) => {
      const icon = r.status === 'done' ? '&#x2713;' : r.status === 'partial' ? '&#x25B6;' : '&#x2717;';
      const cls = r.status === 'done' ? 'st-done' : r.status === 'partial' ? 'st-partial' : 'st-fail';
      const ev = r.evidence ? `<span class="ev">${esc(truncate(r.evidence, 100))}</span>` : '';
      return `<tr><td>${i + 1}</td><td>${esc(truncate(r.text, 80))}</td><td class="${cls}">${icon}</td><td>${ev}</td></tr>`;
    }).join('')
    : '<tr><td colspan="4" style="color:var(--muted)">예측 데이터 없음 — 교차 검증 불가</td></tr>';

  // Section 2: Reviewer analysis
  const reviewerContent = reviewerText
    ? esc(truncate(reviewerText, 4000))
    : '리뷰어 분석 텍스트가 없습니다.';

  // Section 3: Bot team table
  const botRows = botSummaries.length > 0
    ? botSummaries.map(b =>
      `<tr><td>${esc(b.name)}</td><td>${b.tasks}</td><td>$${b.cost.toFixed(4)}</td><td>${esc(b.status)}</td></tr>`
    ).join('')
    : '<tr><td colspan="4" style="color:var(--muted)">봇 실행 데이터 없음</td></tr>';

  // Section 4: Modified files
  const fileItems = modifiedFiles.length > 0
    ? modifiedFiles.slice(0, 20).map(f => `<li>${esc(f)}</li>`).join('')
    : '<li style="color:var(--muted)">변경된 파일 없음</li>';

  // Section 5: Failure reasons
  const failItems = failureReasons.length > 0
    ? failureReasons.slice(0, 8).map(f => {
      const code = f.errorCode ? `<span class="err-code">${esc(f.errorCode)}</span> ` : '';
      return `<li>${code}<strong>${esc(f.botName)}</strong> — ${esc(truncate(f.reason, 120))}<br><span style="color:var(--muted);font-size:12px">Task: ${esc(truncate(f.task, 80))}</span></li>`;
    }).join('')
    : '';

  // Section 6: Original prediction criteria
  const criteriaItems = prediction?.completionCriteria && prediction.completionCriteria.length > 0
    ? prediction.completionCriteria.map(c => `<li>${esc(c)}</li>`).join('')
    : '<li style="color:var(--muted)">완료 기준 없음</li>';

  return `<!doctype html>
<html lang="ko">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Review Report — ${esc(topic)}</title>
  <style>
    :root{
      --bg:#0b1020;--panel:#111831;--card:#182243;--text:#e8eefc;--muted:#9bb0da;
      --line:#355091;--acc:#79a9ff;--ok:#7be2b1;--warn:#ffd77f;--fail:#ff7b7b;
    }
    *{box-sizing:border-box}
    body{margin:0;font-family:ui-sans-serif,system-ui,-apple-system,Segoe UI,Roboto,sans-serif;color:var(--text);background:
      radial-gradient(circle at 20% 10%, #243e7a 0%, rgba(36,62,122,0) 35%),
      radial-gradient(circle at 80% 20%, #1e2c54 0%, rgba(30,44,84,0) 42%),
      var(--bg);}
    .wrap{max-width:1280px;margin:0 auto;padding:28px 24px 64px}
    .hero{display:grid;grid-template-columns:1.4fr 1fr;gap:20px;align-items:stretch}
    .panel{background:rgba(17,24,49,.9);border:1px solid var(--line);border-radius:16px;padding:18px}
    h1{margin:0 0 8px;font-size:26px;line-height:1.2}
    h2{margin:0 0 10px;font-size:17px;color:var(--acc)}
    p{margin:0}
    .kpis{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px}
    .kpi{background:var(--card);border:1px solid var(--line);border-radius:12px;padding:12px}
    .kpi b{display:block;font-size:20px}
    .kpi small{color:var(--muted)}
    .grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:16px;margin-top:16px}
    .box{background:var(--panel);border:1px solid var(--line);border-radius:14px;padding:16px}
    .full{grid-column:1/-1}
    table{width:100%;border-collapse:collapse;font-size:13px;margin:8px 0}
    th{background:rgba(24,34,67,.8);text-align:left;padding:8px 10px;border:1px solid var(--line);font-weight:600}
    td{padding:6px 10px;border:1px solid var(--line)}
    tr:nth-child(even) td{background:rgba(24,34,67,.3)}
    .st-done{color:var(--ok);font-size:18px;text-align:center}
    .st-partial{color:var(--warn);font-size:18px;text-align:center}
    .st-fail{color:var(--fail);font-size:18px;text-align:center}
    .ev{color:var(--muted);font-size:12px}
    .err-code{display:inline-block;padding:1px 6px;border-radius:4px;background:rgba(255,123,123,.15);color:var(--fail);font-size:11px;font-weight:600}
    pre{background:#0d1530;border:1px solid var(--line);border-radius:10px;padding:14px;font-size:12px;line-height:1.5;color:#c6d6fb;white-space:pre-wrap;word-break:break-word;max-height:400px;overflow-y:auto}
    ul{margin:6px 0;padding-left:18px}
    li{margin:4px 0;font-size:13px}
    .footer{margin-top:16px;font-size:12px;color:var(--muted)}
    @media (max-width:1024px){
      .hero,.grid{grid-template-columns:1fr}
    }
  </style>
</head>
<body>
  <main class="wrap">
    <section class="hero">
      <article class="panel">
        <h1>Review Report — ${esc(topic)}</h1>
        <p style="color:var(--muted)">예측(Output Preview) 대비 실제 개발 결과를 교차 검증한 보고서입니다.</p>
      </article>
      <aside class="panel kpis">
        <div class="kpi"><small>작업 성공률</small><b style="color:${successRate >= 80 ? 'var(--ok)' : 'var(--warn)'}">${successRate}%</b></div>
        <div class="kpi"><small>목표 달성률</small><b style="color:${achievementRate >= 80 ? 'var(--ok)' : 'var(--warn)'}">${achievementRate}%</b></div>
        <div class="kpi"><small>총 비용</small><b>$${totalCostUsd.toFixed(4)}</b></div>
        <div class="kpi"><small>소요 시간</small><b>${duration}</b></div>
      </aside>
    </section>

    <section class="grid">
      <article class="box full">
        <h2>1) 예측 vs 실제 결과 대조표</h2>
        <table>
          <thead><tr><th>#</th><th>요구사항 (Prediction)</th><th>상태</th><th>근거</th></tr></thead>
          <tbody>${reqRows}</tbody>
        </table>
      </article>

      <article class="box full">
        <h2>2) 리뷰어 분석 결과</h2>
        <pre>${reviewerContent}</pre>
      </article>

      <article class="box">
        <h2>3) Bot Team 실적</h2>
        <table>
          <thead><tr><th>Bot</th><th>Tasks</th><th>Cost</th><th>Status</th></tr></thead>
          <tbody>${botRows}</tbody>
        </table>
      </article>

      <article class="box">
        <h2>4) 변경된 파일 목록</h2>
        <ul>${fileItems}</ul>
      </article>

      ${failItems ? `<article class="box full"><h2>5) 실패 원인</h2><ul>${failItems}</ul></article>` : ''}

      <article class="box full">
        <h2>${failItems ? '6' : '5'}) 예측 완료 기준 (참조)</h2>
        <ul>${criteriaItems}</ul>
      </article>
    </section>

    <p class="footer">Generated Review Report Artifact &bull; ClaudeBot Workflow Engine</p>
  </main>
</body>
</html>`;
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
