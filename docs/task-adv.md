# Adv 구현 계획서 — Task Breakdown

> 참조: [Adv.md](./Adv.md) (Phase 3~5 개선 로드맵)
> 선행 조건: Phase 2 BotGraph 구현 완료
> 최종 업데이트: 2026-03-02

---

## Phase 2: BotGraph 기반 인프라 (선행 필수)

> Adv.md의 모든 기능이 이 인프라 위에서 동작한다. `src/swarm/` 디렉토리 신규 생성.

### 2.1 Zod 스키마 및 타입 정의

- [x] `src/swarm/types.ts` — `BotDefinition`, `SwarmGraphConfig`, `BotMessage`, `RegistryEntry` Zod 스키마 정의 [budget:1.00] [turns:15]
- [x] `claudebot.swarm.json` JSON Schema 작성 및 config 예시 파일 생성 [budget:0.50] [turns:10]

### 2.2 Config 로더 및 봇 팩토리

- [x] `src/swarm/config-loader.ts` — `loadSwarmConfig()` 구현. `claudebot.swarm.json` 파일 읽기 + Zod 유효성 검사 [budget:1.00] [turns:15]
- [x] `src/swarm/bot-factory.ts` — `buildBotConfig(botName, def, root)` → `ClaudeBotConfig` 파생 함수 구현 [budget:1.00] [turns:15]

### 2.3 통신 데이터 계층

- [x] `src/swarm/inbox.ts` — `InboxManager` 클래스 구현. inbox 파일 읽기/쓰기, `canContact` 화이트리스트 강제, 메시지 봉투 파싱 [budget:2.00] [turns:30]
- [x] `src/swarm/board.ts` — `BulletinBoard` 클래스 구현. `board.md`에 타임스탬프 항목 추가 (append-only) [budget:1.00] [turns:15]
- [x] `src/swarm/registry.ts` — `RegistryManager` 클래스 구현. `registry.json` 원자적 읽기/쓰기, `.registry.lock` 센티넬 파일 동시성 제어 [budget:1.50] [turns:20]
- [x] `src/swarm/workspace.ts` — `bootstrapWorkspace()` 구현. config 기반 디렉토리 구조 자동 생성 (inbox/, 봇별 workspace/, board.md, registry.json) [budget:1.00] [turns:15]

### 2.4 오케스트레이터

- [x] `src/swarm/orchestrator.ts` — `SwarmOrchestrator` 클래스 구현. `Object.entries(config.swarmGraph.bots)` 순회하여 N개 `ClaudeBot` 인스턴스 생성 + `Promise.all`로 병렬 실행 [budget:2.00] [turns:30]
- [x] 종료 감지 로직 추가 — `terminatesOnEmpty` 봇이 `SWARM_COMPLETE`를 `board.md`에 게시하면 `gracePeriodMs` 후 전체 종료 [budget:1.00] [turns:15]

### 2.5 CLI 통합

- [x] `src/index.ts`에 `claudebot swarm --config <path>` 명령어 추가 (Commander.js) [budget:1.00] [turns:15]
- [x] `claudebot status --swarm` 플래그 추가 — 봇별 비용 집계 표시 [budget:0.50] [turns:10]

### 2.6 예시 및 프롬프트

- [x] `examples/swarm-dev-team/claudebot.swarm.json` — 소프트웨어 개발팀 예시 config (coordinator + worker + reviewer) [budget:0.50] [turns:10]
- [x] `examples/swarm-dev-team/prompts/` — coordinator.md, worker.md, reviewer.md 시스템 프롬프트 작성 [budget:1.00] [turns:15]

### 2.7 통합 테스트

- [ ] BotGraph 2봇 최소 구성 (coordinator + worker) 통합 테스트 — 작업 할당 → 실행 → 완료 사이클 검증 [budget:3.00] [turns:30]
- [ ] BotGraph 3봇 구성 (coordinator + worker + reviewer) 통합 테스트 — 리뷰 → REWORK 사이클 검증 [budget:3.00] [turns:30]

---

## Phase 3: Dashboard v1 (TUI 봇 모니터링)

> 기술 변경: TUI(`ink`) 대신 Web Dashboard(Phase 5)로 직접 구현.
> Phase 3의 핵심 기능(EventBus, 비용 모니터링)은 Web Dashboard에 통합 완료.

### 3.1 EventBus 인프라

- [x] `src/events/event-bus.ts` — `SwarmEventBus` 클래스 구현 (Node.js `EventEmitter` 기반). 이벤트 타입: `bot:created`, `bot:completed`, `bot:status`, `cost:update`, `chat:message`, `tool:used`, `task:metrics`, `drift:detected`, `cost:alert` [budget:1.00] [turns:15]
- [x] `src/events/types.ts` — EventBus 이벤트 페이로드 타입 정의 (Zod) [budget:0.50] [turns:10]
- [x] `SwarmOrchestrator`에 EventBus 통합 — 봇 상태 변경/메시지/비용 갱신 시 이벤트 발행 [budget:1.00] [turns:15]

### 3.2~3.5, 3.7~3.10 TUI 컴포넌트

> ⏭ Phase 5 Web Dashboard로 대체. TUI 별도 구현 생략.
> Web Dashboard에서 동일 기능 구현 완료: BotStatusPanel, ChatTimeline, DecisionCard, WorkflowBar 등.

### 3.6 비용 모니터링

- [x] `CostTracker`에 봇 ID별 비용 귀속 기능 추가 (`recordForBot(botId, costUsd)`) [budget:1.00] [turns:15]
- [x] Dashboard에 실시간 비용 표시 + EventBus `cost:alert` 이벤트 발행 [budget:0.50] [turns:10]

---

## Phase 4: Orchestrator (동적 봇 생성)

> BotGraph 위에 구축되는 AI 레이어. 동적 봇 생성/관리 + 4-Step Workflow.

### 4.1 SwarmOrchestrator 동적 확장 API

- [x] `SwarmOrchestrator.addBot(name, definition)` — 런타임에 새 ClaudeBot 인스턴스 생성 + inbox 동적 등록 [budget:2.00] [turns:30]
- [x] `SwarmOrchestrator.removeBot(name)` — 봇 graceful 종료 + inbox 정리 [budget:1.00] [turns:15]
- [x] `InboxManager`에 동적 봇 등록/해제 지원 추가 (`registerBot`, `unregisterBot`) [budget:0.50] [turns:10]
- [x] `canContact` 화이트리스트 동적 확장 — `addBot()` 시 config에 봇 정의 자동 등록 [budget:0.50] [turns:10]

### 4.2 Orchestrator 봇 타입

- [x] `src/swarm/types.ts`에 `OrchestratorBotDefinition` 타입 추가 (`"type": "orchestrator"` 필드) [budget:0.50] [turns:10]
- [x] `src/orchestrator/types.ts`에 `BotProposal` 인터페이스 정의 — name, role, model, allowedTools, canContact, maxBudgetPerTaskUsd, justification (Zod 스키마) [budget:0.50] [turns:10]
- [x] Orchestrator 전용 시스템 프롬프트 — `dashboard/src/server/services/workflow-engine.ts`에서 워크플로우 오케스트레이션 구현 [budget:1.00] [turns:15]

### 4.3 봇 생성 승인 (HITL)

- [x] Orchestrator의 출력에서 `BotProposal` JSON 파싱 로직 구현 (`BotProposalSchema.parse()`) [budget:1.50] [turns:20]
- [x] Dashboard에 Bot Team Proposal Decision Card 표시 (봇 이름, 역할, 모델, 도구, 예산, 근거) [budget:1.50] [turns:20]
- [x] 사용자 승인/수정/거부 인터랙션 → WorkflowEngine에서 결과 처리 → `addBot()` 호출 가능 [budget:1.50] [turns:20]

### 4.4 봇 수 제한 및 비용 가드레일

- [x] config에 `maxConcurrentBots` 필드 추가 (기본값: 5) + Zod 스키마 업데이트 [budget:0.50] [turns:10]
- [x] config에 `costAlertThresholds` 필드 추가 (기본값: [0.7, 0.9]) + 임계값 도달 시 EventBus `cost:alert` 이벤트 발행 [budget:0.50] [turns:10]
- [x] `addBot()`에서 `maxConcurrentBots` 초과 시 봇 생성 거부 + Error throw [budget:0.50] [turns:10]

### 4.5 메시지 우선순위 큐

- [x] `src/swarm/priority-queue.ts` — `PriorityMessageQueue` 클래스 (인메모리 MinHeap, USER > ORCHESTRATOR > BOT_TASK > BOT_INFO) [budget:1.50] [turns:20]
- [x] `restoreFromMessages()` — 파일 inbox에서 큐 복구 (재시작 후 복구용) [budget:1.00] [turns:15]
- [x] `parseTasks()`에 `[priority:N]` 태그 지원 추가 [budget:0.50] [turns:10]

### 4.6 3-Step Workflow — Step 1: 목표 설정 온보딩

- [x] `src/orchestrator/onboarding.ts` — 온보딩 상태 머신 구현 (ONBOARDING → POC_PENDING → SUB_BOT_PROPOSAL → EXECUTION → COMPLETE) [budget:2.00] [turns:30]
- [x] 온보딩 대화 로직 — 사용자 목표를 분석하여 PRD-{topic}.md, TechSpec-{topic}.md, Task-{topic}.md 자동 생성 (`generateDocuments()`) [budget:2.00] [turns:30]
- [x] 기술 난이도 평가 → PoC 필요 여부 판단 → PoC 제안 로직 (`assessPoCNeed()`) [budget:1.50] [turns:20]
- [x] `dashboard/src/server/services/workflow-engine.ts` — Dashboard에서 자유 대화 기반 온보딩 + 명시적 단계 전환 구현 [budget:2.00] [turns:30]

### 4.7 3-Step Workflow — Step 2: Sub-Bot 제안

- [x] WorkflowEngine에서 프로젝트 분석 → 필요 역할 자동 도출 → Bot Team 제안 생성 [budget:1.50] [turns:20]
- [x] 사용자 승인 완료 후 봇 생성 + 실행 시작 [budget:1.00] [turns:15]

### 4.8 3-Step Workflow — Step 3: 작업 진행

- [x] WorkflowEngine 실행 단계 — 봇 생성 + 진행 상황 추적 + 완료 보고 [budget:2.00] [turns:30]
- [x] `src/orchestrator/drift-detector.ts` — 도메인 이탈 감지 로직 (Jaccard 기반 키워드 유사도, 한국어 지원) [budget:2.00] [turns:30]
- [x] `analyzeParallelTasks()` — Task 간 의존성 분석 → 독립 작업 병렬 할당 그룹 생성 [budget:1.50] [turns:20]
- [x] 작업 완료 판단 — WorkflowEngine `completed` 단계에서 결과 보고서 안내 [budget:1.00] [turns:15]

### 4.9 Orchestrator 통합 테스트

- [ ] 온보딩 → 봇 제안 → 승인 → 실행 → 완료 E2E 사이클 테스트 [budget:5.00] [turns:60]
- [ ] 도메인 이탈 감지 시나리오 테스트 [budget:2.00] [turns:30]
- [ ] `maxConcurrentBots` 초과 시 거부 동작 테스트 [budget:1.00] [turns:15]

---

## Phase 5: Dashboard v2 (대화형 + 보고서)

> 기술: React + Vite + Tailwind CSS v4 + Fastify + @fastify/websocket.
> `dashboard/` 디렉토리에 독립 프로젝트로 구현.

### 5.1 Web Dashboard 서버

- [x] `dashboard/src/server/index.ts` — Fastify HTTP 서버 + @fastify/websocket [budget:2.00] [turns:30]
- [x] WebSocket 기반 실시간 이벤트 스트리밍 (chat, workflow, bots, decision) [budget:1.50] [turns:20]
- [x] `--open` 플래그로 브라우저 자동 열기 + `--port` 설정 [budget:0.50] [turns:10]

### 5.2 Web UI 프론트엔드

- [x] `dashboard/` 독립 프로젝트 — React + Vite + TypeScript + Tailwind CSS v4 [budget:1.00] [turns:15]
- [x] Layout (Header + Sidebar + Content), 멀티페이지 (Dashboard, Sessions, Tasks, Analytics, Config, Chat) [budget:3.00] [turns:40]
- [x] 다크 모드 기본 테마 (CSS custom properties) [budget:1.00] [turns:15]
- [x] 반응형 레이아웃 — Sidebar 토글 + 컨텐츠 영역 유동적 크기 [budget:1.50] [turns:20]
- [x] 키보드 단축키 (`Ctrl+K` 검색 포커스) [budget:1.00] [turns:15]

### 5.3 대화형 인터페이스

- [x] ChatInput — Orchestrator에게 메시지 전송 (WebSocket + REST 폴백), 옵티미스틱 UI [budget:1.50] [turns:20]
- [x] Internal Channel 탭 — All / Main / Internal 채널 분리 탭 [budget:1.00] [turns:15]
- [x] `@mention` 패턴 — 활성 봇 목록에서 @멘션 자동완성 드롭다운 [budget:1.00] [turns:15]
- [x] 비활성 탭 알림 — `document.visibilitychange` 기반 `(N) ClaudeBot` 탭 제목 [budget:0.30] [turns:5]
- [x] 자동 스크롤 제어 — 하단 고정 모드, 과거 탐색 시 "N개 새 메시지 ↓" 버튼 [budget:0.50] [turns:10]

### 5.4 검색 및 필터

- [x] ChatSearchBar — 대화 키워드 검색 (실시간 하이라이트) [budget:1.00] [turns:15]
- [x] 봇별 필터 드롭다운 [budget:1.00] [turns:15]

### 5.5 HTML 결과 보고서

- [x] `src/report/generator.ts` — standalone HTML 보고서 자동 생성 (`generateHtmlReport()`) [budget:2.00] [turns:30]
- [x] 보고서 내용: Summary Cards, Tasks 테이블, Bot Contributions, Modified Files, QA Results [budget:2.00] [turns:30]
- [x] 비용 바 차트 (Budget Usage), 봇별 기여도 퍼센트 [budget:1.00] [turns:15]

### 5.6 알림 시스템

- [x] NotificationToast — 4단계 알림 계층 (Critical/Important/Info/Debug) + 자동 해제 타이머 [budget:1.50] [turns:20]
- [x] Decision pending 시 Important 알림 자동 생성 [budget:0.50] [turns:10]

### 5.7 접근성 (WCAG 2.1 AA)

- [x] ARIA 라벨 — `role="log"`, `role="tablist"`, `role="search"`, `aria-label`, `aria-live="polite"` [budget:1.00] [turns:15]
- [x] 키보드 네비게이션 — Tab/Enter/Escape 지원, Ctrl+K 검색 포커스 [budget:1.00] [turns:15]
- [x] 알림 시스템에 `role="alert"` + `aria-live="assertive"` + 아이콘+텍스트 병용 [budget:0.50] [turns:10]

---

## Cross-cutting: 비용 관리 강화

> Phase 3~5 전체에 걸쳐 점진적으로 구현.

- [x] `CostTracker`에 봇 ID별 비용 귀속 (`costByBot: Record<string, number>`, `recordForBot()`) 추가 [budget:0.50] [turns:10]
- [x] `CostSummary`에 `costByModel`, `totalInputTokens`, `totalOutputTokens` 실제 추적 구현 + `CostTracker.record()`에 model/token 파라미터 추가 [budget:1.00] [turns:15]
- [ ] config에 `modelRouting: 'auto' | 'manual'` 필드 추가 — auto 모드에서 작업 복잡도에 따라 모델 자동 선택 [budget:2.00] [turns:30]
- [ ] 시간대별 비용 추이 데이터 수집 및 저장 (`sessions.json` 확장 또는 별도 파일) [budget:1.00] [turns:15]

---

## Cross-cutting: 관측성 (Observability)

- [x] EventBus에 `tool:used` 이벤트 타입 정의 — SDK 메시지 스트림에서 도구 사용 추출용 [budget:1.00] [turns:15]
- [x] EventBus에 `task:metrics` 이벤트 타입 정의 — 작업별 durationMs, reworkCount 추적용 [budget:0.50] [turns:10]
- [x] `task:metrics`에 `reworkCount` 필드 — REWORK 비율 추적 가능 [budget:0.50] [turns:10]
- [ ] 봇 활용률 계산 — 활성 시간 / (활성 + 대기) 시간 [budget:0.50] [turns:10]

---

## Cross-cutting: 기존 코드 수정

> Adv.md 구현을 위해 기존 컴포넌트에 필요한 변경사항.

- [x] `src/logger/index.ts` — 커스텀 콘솔 래퍼로 유지 (Pino Logger 인터페이스 호환). TechSpec 문서 수정 완료 [budget:1.00] [turns:15]
- [x] `src/types.ts` `CostSummary` — `costByModel`/`costByBot`/`totalInputTokens`/`totalOutputTokens` 실제 연동 완료 [budget:0.50] [turns:10]
- [x] `src/session/manager.ts` — TechSpec에 문서화된 메서드명 `record()` → 실제 코드의 `recordResult()` 불일치 해소 (문서 수정) [budget:0.30] [turns:5]
- [x] `src/bot.ts` — `BotRunResult.skipped` 카운터 실제 증가 로직 확인 완료 (line 91, 95에서 정상 증가) [budget:0.30] [turns:5]

---

## 문서 동기화

- [x] `docs/TechSpec.md` CLI 플래그 표 수정 — `-c, --config` → `-c, --cwd` (실제 코드와 일치) [budget:0.30] [turns:5]
- [x] `docs/TechSpec.md` 파일 구조에 `botgraph-guide.md`, `claude-agent-sdk-guide.md`, `Adv.md`, `src/swarm/` 추가 [budget:0.30] [turns:5]
- [x] `docs/TechSpec.md` `SessionManager.record()` → `recordResult()` 메서드명 수정 [budget:0.30] [turns:5]
- [x] `docs/TechSpec.md` `CostSummary` 인터페이스를 실제 코드와 동기화 (`costByModel`, `costByBot`, `totalInputTokens`, `totalOutputTokens`) [budget:0.30] [turns:5]
- [x] `docs/TechSpec.md` 로거 문서 수정 — "Pino" → 커스텀 콘솔 래퍼 (Pino 인터페이스 호환)으로 갱신 [budget:0.30] [turns:5]
- [x] `docs/claude-agent-sdk-guide.md` placeholder URL (`your-repo`) 제거 [budget:0.30] [turns:5]
- [x] `docs/PRD.md` Section 10에 `> ✅ 구현 완료 (Phase 2)` 배너 추가 [budget:0.30] [turns:5]
- [x] `docs/botgraph-guide.md`에 `claudebot swarm` 명령어 구현 완료 반영 (상태 배너 업데이트) [budget:0.30] [turns:5]
- [ ] `README.md` 신규 생성 — 프로젝트 소개, 설치, 빠른 시작, 사용법, 아키텍처 개요, 설정 레퍼런스 [budget:2.00] [turns:30]
