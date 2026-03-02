# 실행 작업 목록 (Tasks): ClaudeBot

> PRD v0.3 + TechSpec 기준 · 체크박스 형식

---

## v0.2 — ChatPage + WorkflowEngine ✅ 완료

- [x] Fastify 5 서버 구조 (`dashboard/src/server/index.ts`)
- [x] ChatManager — 메시지 저장, WebSocket 브로드캐스트, JSON 영속화
- [x] WorkflowEngine — 5-Phase 상태 머신 (idle→onboarding→...→completed)
- [x] Phase 1 Onboarding — 자유 대화, 진행 키워드 감지, Bot Team 제안 Decision Card
- [x] Phase 2~5 — 기본 전환 로직 (시뮬레이션)
- [x] REST API 8개 라우트 (`chat`, `project`, `events`, `sessions`, `summary`, `config`, `report`, `tasks`)
- [x] WebSocket `/api/chat/ws` — 실시간 채팅 송수신
- [x] SSE `/api/events` — 파일 감시 (chokidar)
- [x] ChatPage UI — 메시지 타임라인, DecisionCard, WorkflowBar, BotStatusPanel
- [x] Optimistic UI — 사용자 메시지 즉시 표시 + WS/REST 폴백
- [x] useWebSocket / useSSE — 자동 재연결 (지수 백오프)
- [x] useProject — Context + localStorage 영속화
- [x] SdkExecutor — Agent SDK `query()` 래퍼, abort, 비용 추적
- [x] Config 로더 — Zod 스키마 검증 (`src/config.ts`)
- [x] FileReader — AGENTS.md, docs/, config 읽기

---

## v0.3 — HTML Output Preview ✅ 완료

### Phase 2: Prediction — HTML 렌더링

- [x] `generatePrediction()`에서 실제 HTML 문자열 생성 로직 구현
  - 현재: 텍스트 기반 Decision Card → HTML 시각화로 교체
  - ① 예상 아키텍처 다이어그램 (컴포넌트 박스)
  - ② 사용자 관점 핵심 흐름 (플로우 스텝)
  - ③ 완료 기준 체크리스트
- [x] ChatPage에 HTML Preview 렌더링 컴포넌트 추가
  - `DecisionCard`에서 `type='prediction'` 일 때 HTML 인라인 렌더링
  - iframe sandbox 또는 `dangerouslySetInnerHTML` + 스타일 격리
- [x] Preview 프레임 스타일링 — 흰색 배경, 라운드 코너, 라벨 배지

### Phase 3: Documentation — HTML 탭 시각화

- [x] `generateDocumentation()`에서 문서 3종의 HTML 시각화 생성
  - PRD 탭: 사용자 스토리, 비기능 요구사항
  - TechSpec 탭: API 엔드포인트 테이블, 스키마 변경
  - Tasks 탭: 실행 작업 넘버링 체크리스트
- [x] ChatPage에 탭 형태 문서 미리보기 렌더링
  - 탭 전환 UI (PRD / TechSpec / Tasks)
  - 각 탭 내용은 HTML 프레임으로 시각화

---

## v0.4 — Agent SDK 연동 (BotComposer) ✅ 완료

### BotComposer 서비스 구현

- [x] `dashboard/src/server/services/bot-composer.ts` 생성
- [x] `BotSpec` 인터페이스 정의 — name, role, systemPrompt, config, tasks
- [x] `BotComposer` 클래스 구현
  - `constructor(executor: IExecutor, chatManager: ChatManager)`
  - `createBotTeam(specs: BotSpec[]): Bot[]`
  - `spawnBot(spec: BotSpec): Bot` — 동적 봇 추가
  - `executeBot(bot: Bot, task: string): Promise<TaskResult>`
- [x] Bot 실행 시 `SdkExecutor.execute()` 호출 연결
  - config 매핑: 봇별 `systemPrompt`, `maxBudgetPerTaskUsd`, `model` 오버라이드
  - `callbacks.onCost` → `chatManager.broadcastBots()`
  - `callbacks.onProgress` → internal channel 메시지
- [x] Bot 출력 → `chatManager.addMessage('bot', content, { botName, channel: 'internal' })`

### WorkflowEngine 연동

- [x] `WorkflowEngine`에 `BotComposer` 의존성 주입
- [x] Phase 1 Bot Team 승인 → `BotComposer.createBotTeam()` 호출
- [x] `AppState`에 `BotComposer` 추가 (`dashboard/src/server/index.ts`)

---

## v0.5 — Phase 4 실제 봇 실행 + 병렬 처리 ✅ 완료

### 봇 실행 파이프라인

- [x] `startDevelopment()` — setTimeout 시뮬레이션을 실제 SDK 호출로 교체
- [x] Task 분배 로직 — 대화 컨텍스트에서 Task 추출
- [x] 병렬 실행 — 독립 Task는 `Promise.all()` 동시 실행
- [x] 순차 실행 — Reviewer는 Developer 완료 후 순차 실행
- [x] 봇 상태 실시간 업데이트 — `BotStatusDTO` 브로드캐스트
  - `status: 'working' | 'idle' | 'completed' | 'error'`
  - `tasksCompleted`, `tasksFailed`, `costUsd` 갱신

### Hub-Spoke 통신 구현

- [x] 봇 출력 해석 → ClaudeBot이 internal channel에 메시지로 기록
- [x] Reviewer → ClaudeBot → Developer 피드백 전달 체인 (pipeline 패턴)
- [x] 봇 간 직접 통신 차단 (아키텍처적으로 불가능하게 설계)

### 메시지 큐

- [x] `MessageQueue` 클래스 구현 (`dashboard/src/server/services/message-queue.ts`)
  - `enqueue(msg: QueuedMessage): void`
  - `process(): Promise<void>` — 우선순위 순 처리
  - P1(사용자) > P2(에러) > P3(완료) > P4(진행보고)
- [x] P1 메시지 도착 시 pause 플래그 설정 → 우선 처리
- [x] WorkflowEngine에 MessageQueue 연동

---

## v0.6 — Review + 보고서 + Goal Drift ✅ 완료

### Phase 5: Review Bot + 보고서

- [x] `startReview()` — HTML Review Report Decision Card 생성
  - 각 Task 결과 Pass/Fail 요약
  - Bot Team 성과 테이블
  - 목표 대비 달성도 체크리스트
- [x] 결과 보고서 Decision Card 생성 (type: 'review')
  - 완료 작업 목록 + Pass/Fail
  - 비용/시간 요약
  - 코드 변경 파일 목록
  - 미완료 항목 (있을 경우)
- [x] 사용자 최종 승인 → `setStep('completed')`
- [x] `buildReviewHtml()` — html-preview.ts에 Review Report HTML 템플릿 추가

### Goal Drift 감지

- [x] 봇 실행 중 중단 명령 처리 ("중단", "stop", "abort" 등)
- [x] 이탈 시 abortAll() → 모든 봇 즉시 중단 + 리뷰로 전환

### 세션 영속화

- [x] `sessions.json` 쓰기 로직 구현 (`SessionManager`)
  - Bot 실행 완료 시 `SessionRecord` 기록
  - `totalCostUsd` 누적 업데이트
- [x] SessionManager — AppState 연동, 프로젝트 설정 시 자동 로드
- [x] 예산 한도 도달 시 자동 중단 + 알림

---

## v0.7 — Epic Cycle + Auto-Pilot ✅ 완료

### Epic Cycle 상태 머신

- [x] `completed` 상태 진입 시 Epic 완료 처리
  - Epic 요약 카드 생성 (소요 시간, 비용, Tasks, 봇, 파일 목록)
  - Epic 카운터 증가
- [x] 코드베이스 재분석 — AGENTS.md, docs/, TODO 주석 스캔
- [x] 다음 Epic 후보 3개 생성 + Decision Card
- [x] workflow 초기화 (messages 유지, step → onboarding, epic 카운터 보존)

### Auto-Pilot 모드

- [x] Config에 `autoOnboarding` 필드 추가 (`src/config.ts` Zod 스키마)
- [x] `autoOnboarding: true` → #1 후보 자동 선정 + 다음 사이클 자동 시작
- [x] `autoOnboarding: false` → Decision Card 대기 (수동 선택)
- [x] Auto-Pilot 중단 조건:
  - 잔여 예산 < 예상 비용 → 자동 중단
  - 사용자 채팅으로 중단 요청 → 즉시 중단
- [x] WorkflowBar에 Epic 카운터 + Auto-Pilot 표시기 연동

### ChatPage Epic UI

- [x] Epic 완료 요약 메시지 렌더링
- [x] Next Epic 제안 카드 렌더링 (3개 후보 + 자동/수동 모드)
- [x] 완료 시 다음 Epic 시작 가능 (대화 입력 또는 Decision Card)
- [x] WorkflowBar Auto-Pilot 토글 버튼

---

## v1.0 — 전체 통합 + 안정화 ✅ 완료

### 통합 테스트

- [x] Phase 1→5 전체 사이클 E2E 테스트 (Mock SDK — 21 tests pass)
- [x] Epic Cycle 연속 2회 실행 테스트
- [x] WebSocket 재연결 시나리오 테스트
- [x] 예산 초과 시 자동 중단 테스트
- [x] 서버 재시작 후 chat.json 복원 테스트

### 안정화

- [x] SdkExecutor에 `withRetry` 연동 — API 일시 오류 대응
- [x] 봇 실행 중 서버 크래시 복구 — 시뮬레이션 폴백 (SDK 미연결 시)
- [x] 대용량 chat.json 성능 최적화 (페이징 또는 아카이브)
- [x] TasksPage 실제 구현 — Bot Task 추적 + Epic 히스토리 UI

### 문서화

- [x] CLAUDE.md 최종 업데이트 (아키텍처 변경 반영)
- [x] README.md 사용자 가이드
- [x] Config 옵션 전체 문서
