# Adv 구현 계획서 — Task Breakdown

> 참조: [Adv.md](./Adv.md) (Phase 3~5 개선 로드맵)
> 선행 조건: Phase 2 BotGraph 구현 완료
> 최종 업데이트: 2026-03-01

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

> 기술: `ink` (React for Terminal). BotGraph의 봇 상태를 실시간으로 표시하는 읽기 전용 TUI.

### 3.1 EventBus 인프라

- [ ] `src/events/bus.ts` — `EventBus` 클래스 구현 (Node.js `EventEmitter` 기반). 이벤트 타입: `bot:status`, `message:new`, `task:update`, `log:entry`, `cost:update` [budget:1.00] [turns:15]
- [ ] `src/events/types.ts` — EventBus 이벤트 페이로드 타입 정의 (Zod) [budget:0.50] [turns:10]
- [ ] `SwarmOrchestrator`에 EventBus 통합 — 봇 상태 변경/메시지/비용 갱신 시 이벤트 발행 [budget:1.00] [turns:15]

### 3.2 TUI 기본 구조

- [ ] `ink`, `react` 의존성 추가. `src/dashboard/` 디렉토리 생성 [budget:0.30] [turns:5]
- [ ] `src/dashboard/App.tsx` — 메인 TUI 컴포넌트 (3-column 레이아웃: BotList | Timeline | ContextPanel) [budget:2.00] [turns:30]
- [ ] `src/dashboard/components/GlobalStatusBar.tsx` — 최상단 고정 바 (프로젝트명, Tasks 진행률, 비용, 활성 봇 수, 큐 깊이, 가동시간) [budget:1.00] [turns:15]

### 3.3 봇 목록 패널

- [ ] `src/dashboard/components/BotList.tsx` — 상태별 그룹핑 (WORKING > WAITING > ERROR > DONE), 봇 카드에 현재 작업/비용/상태 3줄 요약 [budget:1.50] [turns:20]
- [ ] DONE 그룹 접힘/펼침 토글 구현 [budget:0.50] [turns:10]

### 3.4 대화 타임라인

- [ ] `src/dashboard/components/Timeline.tsx` — Task별 Thread 그룹핑, 접힘/펼침 지원 [budget:2.00] [turns:30]
- [ ] `src/dashboard/components/DecisionCard.tsx` — 인라인 의사결정 요청 카드 (선택지 버튼 + 자유 입력) [budget:1.50] [turns:20]

### 3.5 컨텍스트 패널

- [ ] `src/dashboard/components/ContextPanel.tsx` — Detail/Log/Queue 3개 탭 [budget:1.50] [turns:20]
- [ ] Detail 탭: 선택된 봇의 상세 정보 (모델, 비용, turns, 세션 로그) [budget:1.00] [turns:15]
- [ ] Log 탭: Orchestrator 의사결정 로그 (중요도별 색상 + 아이콘 병용) [budget:1.00] [turns:15]

### 3.6 비용 모니터링

- [ ] `CostTracker`에 봇 ID별 비용 귀속 기능 추가 (`recordForBot(botId, costUsd)`) [budget:1.00] [turns:15]
- [ ] GlobalStatusBar에 실시간 비용 표시 (`$3.42 / $50.00`) + 70%/90% 경고 색상 변경 [budget:0.50] [turns:10]

### 3.7 Compact 뷰

- [ ] `src/dashboard/components/CompactView.tsx` — 최소 공간 모니터링 뷰 (1줄 상태 바 + 봇별 1줄 요약) [budget:1.00] [turns:15]
- [ ] `Ctrl+M` 단축키로 메인/Compact 뷰 토글 [budget:0.30] [turns:5]

### 3.8 CLI 통합

- [ ] `src/index.ts`에 `claudebot dashboard` 명령어 추가 — TUI 렌더링 시작 [budget:0.50] [turns:10]
- [ ] `claudebot swarm --dashboard` 플래그로 swarm 실행과 동시에 TUI 표시 [budget:0.50] [turns:10]

### 3.9 키보드 단축키

- [ ] `Ctrl+1/2/3` 패널 간 포커스 전환 [budget:0.50] [turns:10]
- [ ] `J/K` 항목 간 이동 (Vim 스타일) [budget:0.50] [turns:10]
- [ ] `Ctrl+F` 대화 내 검색 [budget:0.50] [turns:10]

### 3.10 오류 상태 UI

- [ ] 봇 크래시 시 봇 카드 빨간 강조 + 에러 메시지 표시 [budget:0.50] [turns:10]
- [ ] 예산 초과 시 GlobalStatusBar 경고 배너 [budget:0.30] [turns:5]
- [ ] 봇 데드락 감지 시 경고 표시 (상호 대기 N초 이상) [budget:1.00] [turns:15]

---

## Phase 4: Orchestrator (동적 봇 생성)

> BotGraph 위에 구축되는 AI 레이어. 동적 봇 생성/관리 + 3-Step Workflow.

### 4.1 SwarmOrchestrator 동적 확장 API

- [ ] `SwarmOrchestrator.addBot(name, definition)` — 런타임에 새 ClaudeBot 인스턴스 생성 + inbox 동적 등록 [budget:2.00] [turns:30]
- [ ] `SwarmOrchestrator.removeBot(name)` — 봇 graceful 종료 + inbox 정리 [budget:1.00] [turns:15]
- [ ] `InboxManager`에 동적 봇 등록/해제 지원 추가 [budget:0.50] [turns:10]
- [ ] `canContact` 화이트리스트 동적 확장 API (`addContact(from, to)`) [budget:0.50] [turns:10]

### 4.2 Orchestrator 봇 타입

- [ ] `src/swarm/types.ts`에 `OrchestratorBotDefinition` 타입 추가 (`"type": "orchestrator"` 필드) [budget:0.50] [turns:10]
- [ ] `BotProposal` 인터페이스 정의 — name, role, model, allowedTools, canContact, maxBudgetPerTaskUsd, justification [budget:0.50] [turns:10]
- [ ] Orchestrator 전용 시스템 프롬프트 템플릿 작성 — 봇 생성 프로토콜, 폴링 우선순위, 도메인 이탈 감지 규칙 포함 [budget:1.00] [turns:15]

### 4.3 봇 생성 승인 (HITL)

- [ ] Orchestrator의 LLM 출력에서 `BotProposal` JSON 파싱 로직 구현 [budget:1.50] [turns:20]
- [ ] Dashboard에 Bot Team Proposal Decision Card 표시 (봇 이름, 역할, 모델, 도구, 예산, 근거) [budget:1.50] [turns:20]
- [ ] 사용자 승인/수정/거부 인터랙션 → Orchestrator에 결과 전달 → `addBot()` 호출 [budget:1.50] [turns:20]

### 4.4 봇 수 제한 및 비용 가드레일

- [ ] config에 `maxConcurrentBots` 필드 추가 (기본값: 5) + Zod 스키마 업데이트 [budget:0.50] [turns:10]
- [ ] config에 `costAlertThresholds` 필드 추가 (기본값: [0.7, 0.9]) + 임계값 도달 시 EventBus 이벤트 발행 [budget:0.50] [turns:10]
- [ ] Orchestrator가 `maxConcurrentBots` 초과 시 봇 생성 거부 + 사용자 알림 [budget:0.50] [turns:10]

### 4.5 메시지 우선순위 큐

- [ ] `src/swarm/priority-queue.ts` — `PriorityMessageQueue` 클래스 (인메모리 MinHeap, 사용자 메시지 > 봇 메시지) [budget:1.50] [turns:20]
- [ ] 인메모리 큐 + 파일 inbox 이중 계층 구현 (재시작 후 복구용) [budget:1.00] [turns:15]
- [ ] `parseTasks()`에 priority 태그 지원 추가 [budget:0.50] [turns:10]

### 4.6 3-Step Workflow — Step 1: 목표 설정 온보딩

- [ ] `src/orchestrator/onboarding.ts` — 온보딩 상태 머신 구현 (ONBOARDING → POC_PENDING → SUB_BOT_PROPOSAL → EXECUTION → COMPLETE) [budget:2.00] [turns:30]
- [ ] 온보딩 대화 로직 — 사용자 목표를 분석하여 PRD-{topic}.md, TechSpec-{topic}.md, Task-{topic}.md 자동 생성 [budget:2.00] [turns:30]
- [ ] 기술 난이도 평가 → PoC 필요 여부 판단 → PoC 제안 로직 [budget:1.50] [turns:20]
- [ ] PoC 전담 Sub-Bot 생성 및 실행 → 결과를 TechSpec에 반영 [budget:2.00] [turns:30]

### 4.7 3-Step Workflow — Step 2: Sub-Bot 제안

- [ ] Task-{topic}.md 분석 → 필요 역할 자동 도출 → BotProposal 목록 생성 [budget:1.50] [turns:20]
- [ ] 사용자 승인 완료 후 `addBot()` API로 봇 일괄 생성 [budget:1.00] [turns:15]

### 4.8 3-Step Workflow — Step 3: 작업 진행

- [ ] Orchestrator 폴링 루프 구현 — 비동기 EventEmitter 기반, Claude 호출과 메시지 처리 분리 [budget:2.00] [turns:30]
- [ ] 도메인 이탈 감지 로직 — 목표 대비 현재 작업의 유사도 평가 → 이탈 시 사용자 알림 + Sub-Bot 원인 조회 [budget:2.00] [turns:30]
- [ ] 병렬 작업 탐지 — Task 간 의존성 분석 → 독립 작업 병렬 할당 [budget:1.50] [turns:20]
- [ ] 작업 완료 판단 — Task-{topic}.md 전체 체크 시 완료 알림 + 다음 작업 자동 진행 [budget:1.00] [turns:15]

### 4.9 Orchestrator 통합 테스트

- [ ] 온보딩 → 봇 제안 → 승인 → 실행 → 완료 E2E 사이클 테스트 [budget:5.00] [turns:60]
- [ ] 도메인 이탈 감지 시나리오 테스트 [budget:2.00] [turns:30]
- [ ] `maxConcurrentBots` 초과 시 거부 동작 테스트 [budget:1.00] [turns:15]

---

## Phase 5: Dashboard v2 (대화형 + 보고서)

> 기술: React + Vite + WebSocket. TUI에서 Web UI로 확장.

### 5.1 Web Dashboard 서버

- [ ] `src/dashboard/server.ts` — Express/Fastify HTTP 서버 + WebSocket 서버 (`ws` 라이브러리) [budget:2.00] [turns:30]
- [ ] EventBus → WebSocket 브릿지 — 서버 사이드 이벤트를 WebSocket으로 클라이언트에 스트리밍 [budget:1.50] [turns:20]
- [ ] `claudebot dashboard --web` 플래그로 Web UI 실행 + 브라우저 자동 열기 [budget:0.50] [turns:10]

### 5.2 Web UI 프론트엔드

- [ ] `web/` 디렉토리 생성. React + Vite + TypeScript 프로젝트 초기화 [budget:1.00] [turns:15]
- [ ] 3-column 레이아웃 구현 (BotList | Timeline | ContextPanel) — TUI 컴포넌트 로직 재사용 [budget:3.00] [turns:40]
- [ ] 다크 모드 기본 테마 (CSS custom properties) [budget:1.00] [turns:15]
- [ ] 반응형 레이아웃 — 1440px+ 풀 3열 → 1024px 좌측 축소 → 768px 탭 전환 [budget:1.50] [turns:20]
- [ ] 키보드 단축키 (`Ctrl+K` 커맨드 팔레트, `Ctrl+1/2/3` 패널 전환) [budget:1.00] [turns:15]

### 5.3 대화형 인터페이스

- [ ] 메인 채팅 입력 컴포넌트 — Orchestrator에게 메시지 전송 (WebSocket) [budget:1.50] [turns:20]
- [ ] Internal Channel 탭 — Sub-Bot 간 대화 표시 (메인 채팅과 분리) [budget:1.00] [turns:15]
- [ ] `@mention` 패턴 — 긴급 시 Sub-Bot 직접 메시지 (Override 메커니즘) [budget:1.00] [turns:15]
- [ ] 비활성 탭 알림 — 브라우저 탭 제목에 카운터 표시 `(N) ClaudeBot` [budget:0.30] [turns:5]
- [ ] 자동 스크롤 제어 — 새 메시지 시 자동 스크롤, 과거 탐색 중이면 "N개 새 메시지" 버튼 [budget:0.50] [turns:10]

### 5.4 검색 및 필터

- [ ] 대화 키워드 검색 [budget:1.00] [turns:15]
- [ ] 봇별/중요도별/시간대별 필터 [budget:1.00] [turns:15]

### 5.5 HTML 결과 보고서

- [ ] `src/report/generator.ts` — 작업 완료 시 HTML 보고서 자동 생성 [budget:2.00] [turns:30]
- [ ] 보고서 내용: 완료 작업 목록, 작업별 시간/비용, 봇별 기여도, 수정 파일 목록, QA 결과, 비용 요약 [budget:2.00] [turns:30]
- [ ] Git diff 통합 뷰 — 변경된 파일의 diff 시각화 [budget:1.50] [turns:20]
- [ ] 비용 대비 성과 차트 (작업당 비용, 봇당 비용, REWORK 비율) [budget:1.00] [turns:15]

### 5.6 알림 시스템

- [ ] 알림 계층 구현 — Critical(모달+사운드), Important(토스트+배지), Info(로그), Debug(상세 뷰) [budget:1.50] [turns:20]
- [ ] 미응답 Decision 30분 재알림 (설정 가능) [budget:0.50] [turns:10]

### 5.7 접근성 (WCAG 2.1 AA)

- [ ] 키보드 네비게이션 — Tab/Shift+Tab 패널 이동, Arrow Key 리스트 이동 [budget:1.00] [turns:15]
- [ ] ARIA 라벨 + live region (실시간 업데이트용) [budget:1.00] [turns:15]
- [ ] 로그 중요도 색상 + 아이콘 + 텍스트 레이블 병용 (색각 이상 대응) [budget:0.50] [turns:10]

---

## Cross-cutting: 비용 관리 강화

> Phase 3~5 전체에 걸쳐 점진적으로 구현.

- [ ] `CostTracker`에 봇 ID별 비용 귀속 (`costByBot: Record<string, number>`) 추가 [budget:0.50] [turns:10]
- [ ] `CostSummary`에 `totalInputTokens`, `totalOutputTokens` 실제 추적 구현 (현재 placeholder) [budget:1.00] [turns:15]
- [ ] config에 `modelRouting: 'auto' | 'manual'` 필드 추가 — auto 모드에서 작업 복잡도에 따라 모델 자동 선택 [budget:2.00] [turns:30]
- [ ] 시간대별 비용 추이 데이터 수집 및 저장 (`sessions.json` 확장 또는 별도 파일) [budget:1.00] [turns:15]

---

## Cross-cutting: 관측성 (Observability)

- [ ] SDK 메시지 스트림에서 도구 사용 이벤트 추출 → EventBus로 발행 [budget:1.00] [turns:15]
- [ ] 작업별 P50/P99 완료 시간 계산 로직 추가 [budget:0.50] [turns:10]
- [ ] REWORK 비율 추적 — QA 실패 → 재작업 횟수 기록 [budget:0.50] [turns:10]
- [ ] 봇 활용률 계산 — 활성 시간 / (활성 + 대기) 시간 [budget:0.50] [turns:10]

---

## Cross-cutting: 기존 코드 수정

> Adv.md 구현을 위해 기존 컴포넌트에 필요한 변경사항.

- [ ] `src/logger/index.ts` — 현재 커스텀 콘솔 래퍼를 실제 Pino로 교체 (TechSpec 문서와 일치시키기 위해) [budget:1.00] [turns:15]
- [ ] `src/types.ts` `CostSummary` — `maxBudgetUsd` 필드 제거, `costByModel`/`totalInputTokens`/`totalOutputTokens` 실제 연동 [budget:0.50] [turns:10]
- [x] `src/session/manager.ts` — TechSpec에 문서화된 메서드명 `record()` → 실제 코드의 `recordResult()` 불일치 해소 (문서 수정) [budget:0.30] [turns:5]
- [x] `src/bot.ts` — `BotRunResult.skipped` 카운터 실제 증가 로직 구현 (현재 항상 0) [budget:0.30] [turns:5]

---

## 문서 동기화

- [x] `docs/TechSpec.md` CLI 플래그 표 수정 — `-c, --config` → `-c, --cwd` (실제 코드와 일치) [budget:0.30] [turns:5]
- [x] `docs/TechSpec.md` 파일 구조에 `botgraph-guide.md`, `claude-agent-sdk-guide.md`, `Adv.md`, `src/swarm/` 추가 [budget:0.30] [turns:5]
- [x] `docs/TechSpec.md` `SessionManager.record()` → `recordResult()` 메서드명 수정 [budget:0.30] [turns:5]
- [ ] `docs/TechSpec.md` `CostSummary` 인터페이스를 실제 코드와 동기화 [budget:0.30] [turns:5]
- [x] `docs/TechSpec.md` 로거 문서 수정 — "Pino" → 커스텀 콘솔 래퍼 (Pino 인터페이스 호환)으로 갱신 [budget:0.30] [turns:5]
- [ ] `docs/claude-agent-sdk-guide.md` placeholder URL (`your-repo`) 제거 또는 실제 URL로 교체 [budget:0.30] [turns:5]
- [x] `docs/PRD.md` Section 10에 `> ✅ 구현 완료 (Phase 2)` 배너 추가 [budget:0.30] [turns:5]
- [ ] `docs/botgraph-guide.md`에 `claudebot swarm` 명령어 구현 완료 반영 [budget:0.30] [turns:5]
- [ ] `README.md` 신규 생성 — 프로젝트 소개, 설치, 빠른 시작, 사용법, 아키텍처 개요, 설정 레퍼런스 [budget:2.00] [turns:30]
