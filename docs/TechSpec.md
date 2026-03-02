# 기술 명세서 (TechSpec): ClaudeBot

> PRD v0.3 기준 · 현재 구현 상태 반영

---

## 1. 시스템 개요

ClaudeBot은 **단일 웹 앱**으로, 사용자가 브라우저에서 대화하면 백엔드가 Agent SDK를 통해 봇을 실행하는 구조이다.

```
┌──────────────────────────────────────────────────────────┐
│  Browser (React 19 SPA)                                  │
│  ┌──────────┐  ┌───────────┐  ┌────────────────────┐    │
│  │ ChatPage │  │ WorkflowBar│  │ Bot Status Panel  │    │
│  └──────────┘  └───────────┘  └────────────────────┘    │
│       │ WebSocket + REST + SSE                           │
├──────────────────────────────────────────────────────────┤
│  Fastify 5 Server (:3001)                                │
│  ┌──────────────┐  ┌───────────────┐  ┌──────────────┐  │
│  │ ChatManager  │  │WorkflowEngine │  │ BotComposer  │  │
│  │ (WS + JSON)  │  │ (5-Phase FSM) │  │ (동적 생성)  │  │
│  └──────────────┘  └───────────────┘  └──────────────┘  │
│       │                    │                  │           │
│       │              ┌─────┴─────┐           │           │
│       │              │ SdkExecutor│←──────────┘           │
│       │              └───────────┘                        │
│       │                    │ Agent SDK                    │
│       ▼                    ▼                              │
│  .claudebot/          Anthropic API                      │
│  chat.json                                               │
│  sessions.json                                           │
└──────────────────────────────────────────────────────────┘
```

---

## 2. 기술 스택

| 계층 | 기술 | 버전 | 비고 |
| ---- | ---- | ---- | ---- |
| Frontend | React + Vite + Tailwind CSS | 19 / 6 / 4 | SPA, bundler resolution |
| Backend | Fastify + WebSocket | 5 | `@fastify/websocket@11` |
| AI Engine | `@anthropic-ai/claude-agent-sdk` | ^0.2.62 | streaming async generator |
| 실시간 | WebSocket (채팅) + SSE (파일 감시) | — | 이중 채널 |
| 검증 | Zod | ^4.0 | config 스키마 |
| 파일 감시 | chokidar | ^4 | `.claudebot/` + config |
| 언어 | TypeScript (ESM) | ^5.7 | `"type": "module"` 전역 |

---

## 3. 디렉토리 구조

```
claude-bot/
├── src/                          # 공유 백엔드 코어
│   ├── index.ts                  # Dashboard 런처 (child process spawn)
│   ├── config.ts                 # Zod config 로더
│   ├── types.ts                  # EngineType, TaskResult, SessionRecord, ClaudeBotConfig
│   ├── engine/
│   │   ├── types.ts              # IExecutor, ExecuteOptions, ExecutorCallbacks
│   │   ├── sdk-executor.ts       # SdkExecutor — Agent SDK 래퍼
│   │   └── factory.ts            # createExecutor() → SdkExecutor
│   ├── logger/index.ts           # console 기반 레벨 로거
│   └── utils/
│       ├── abort.ts              # AbortController + timeout
│       └── retry.ts              # withRetry (지수 백오프)
│
├── dashboard/                    # 풀스택 웹 앱
│   ├── src/
│   │   ├── server/               # Fastify 백엔드
│   │   │   ├── index.ts          # 서버 진입점, AppState, 라우트 등록
│   │   │   ├── routes/           # 8개 API 라우트
│   │   │   │   ├── chat.ts       # REST + WebSocket 채팅 API
│   │   │   │   ├── project.ts    # 프로젝트 선택/조회
│   │   │   │   ├── events.ts     # SSE 엔드포인트
│   │   │   │   ├── sessions.ts   # 세션 기록 조회
│   │   │   │   ├── summary.ts    # 대시보드 요약
│   │   │   │   ├── config.ts     # 설정 조회
│   │   │   │   ├── report.ts     # HTML 보고서 생성
│   │   │   │   └── tasks.ts      # Task 목록 (stub)
│   │   │   └── services/
│   │   │       ├── workflow-engine.ts  # 5-Phase 상태 머신
│   │   │       ├── chat-manager.ts    # 메시지 저장, WS 브로드캐스트
│   │   │       ├── file-reader.ts     # AGENTS.md, docs/, config 읽기
│   │   │       └── watcher.ts         # chokidar 파일 감시, SSE
│   │   │
│   │   ├── client/               # React SPA
│   │   │   ├── main.tsx          # ReactDOM.createRoot
│   │   │   ├── App.tsx           # Router + ProjectProvider
│   │   │   ├── pages/            # 7개 페이지
│   │   │   ├── hooks/            # useWebSocket, useSSE, useApi, useProject
│   │   │   └── components/       # 10개 카테고리
│   │   │
│   │   └── shared/               # 서버/클라이언트 공유 타입
│   │       ├── types.ts          # ClaudeBotConfig, SessionStore
│   │       └── api-types.ts      # DTO, WSMessage, SSEEvent, WorkflowStep
│   │
│   ├── tsconfig.json             # client (bundler, jsx)
│   └── tsconfig.server.json      # server (Node16)
│
├── docs/
│   ├── PRD.md
│   ├── TechSpec.md               # ← 이 문서
│   └── PRD-Preview.html          # 결과물 예측 Preview
│
├── tsconfig.json                 # root (Node16, src/ → dist/)
└── package.json                  # ESM, scripts
```

---

## 4. 핵심 인터페이스 및 타입

### 4.1 IExecutor — 봇 실행 인터페이스

```typescript
// src/engine/types.ts
interface ExecutorCallbacks {
  onCost?: (costUsd: number, sessionId: string) => void;
  onProgress?: (event: string, data: unknown) => void;
}

interface ExecuteOptions {
  prompt: string;
  config: ClaudeBotConfig;
  cwd?: string;
  callbacks?: ExecutorCallbacks;
}

interface IExecutor {
  execute(opts: ExecuteOptions): Promise<TaskResult>;
}
```

### 4.2 TaskResult — 실행 결과

```typescript
// src/types.ts
interface TaskResult {
  success: boolean;
  result: string;
  costUsd: number;
  durationMs: number;
  sessionId: string;
  errors: string[];
}
```

### 4.3 ClaudeBotConfig — 설정 스키마

```typescript
// src/types.ts (Zod-validated in config.ts)
interface ClaudeBotConfig {
  model?: string;                    // default: 최신 Sonnet
  cwd: string;                      // 프로젝트 루트 (필수)
  permissionMode: string;           // default: 'acceptEdits'
  maxBudgetPerTaskUsd?: number;     // 봇 당 예산
  maxTurnsPerTask?: number;         // 봇 당 최대 턴
  maxTotalBudgetUsd?: number;       // 전역 예산 한도
  taskTimeoutMs: number;            // default: 600000 (10분)
  logLevel: string;                 // default: 'info'
  allowedTools?: string[];          // 봇 허용 도구 목록
  systemPromptPrefix?: string;      // 봇 시스템 프롬프트 접두사
  autoOnboarding?: boolean;         // Epic 자동 연속 실행 (Auto-Pilot)
}
```

### 4.4 WorkflowStep — Phase 상태

```typescript
// dashboard/src/shared/api-types.ts
type WorkflowStep =
  | 'idle'
  | 'onboarding'
  | 'prediction'
  | 'documentation'
  | 'development'
  | 'review'
  | 'completed';
```

### 4.5 ChatMessageDTO — 채팅 메시지

```typescript
interface ChatMessageDTO {
  id: string;             // 랜덤 8자 UUID
  role: ChatRole;         // 'user' | 'orchestrator' | 'system' | 'bot'
  botName?: string;       // role='bot' 일 때 봇 이름
  content: string;        // 메시지 본문 (HTML 가능)
  channel: string;        // 'main' | 'internal'
  timestamp: string;      // ISO 8601
  decision?: DecisionCardDTO;
}

type DecisionType = 'prediction' | 'documentation' | 'proposal' | 'review' | 'question';
type DecisionStatus = 'pending' | 'approved' | 'rejected' | 'modified';

interface DecisionCardDTO {
  id: string;
  type: DecisionType;
  title: string;
  description: string;
  options: string[];
  status: DecisionStatus;
  response?: string;
  createdAt: string;
  resolvedAt?: string;
}
```

### 4.6 WebSocket 프로토콜

```typescript
// Client → Server
type WSClientMessage =
  | { type: 'chat'; content: string }
  | { type: 'decision'; decisionId: string; status: DecisionStatus; response?: string };

// Server → Client
type WSServerMessage =
  | { type: 'chat'; message: ChatMessageDTO }
  | { type: 'workflow'; workflow: WorkflowStateDTO }
  | { type: 'bots'; bots: BotStatusDTO[] }
  | { type: 'decision'; decision: DecisionCardDTO }
  | { type: 'error'; message: string };
```

---

## 5. 서비스 상세

### 5.1 WorkflowEngine — 5-Phase 상태 머신

**책임:** Phase 전환 관리, 사용자 메시지 라우팅, Decision Card 생성/처리

```
idle ──[initializeProject]──→ onboarding
                                  │
                    [Bot Team 승인 (Decision Card)]
                                  │
                                  ▼
                             prediction
                                  │
                    [Output Preview 승인 (Decision Card)]
                                  │
                                  ▼
                            documentation
                                  │
                    [문서 확인 후 채팅 승인]
                                  │
                                  ▼
                            development
                                  │
                    [모든 Task 완료 or 사용자 종료]
                                  │
                                  ▼
                              review
                                  │
                    [최종 결과 승인 (Decision Card)]
                                  │
                                  ▼
                            completed
```

**주요 메서드:**

| 메서드 | Phase | 설명 |
| ------ | ----- | ---- |
| `initializeProject(path)` | idle→onboarding | AGENTS.md, docs/ 읽기, 인사 메시지 전송 |
| `handleUserMessage(content)` | 전체 | `workflow.step` switch로 phase별 핸들러 호출 |
| `handleDecisionResolved(card)` | 전체 | `card.type` switch로 phase 전환 |
| `generatePrediction()` | prediction | HTML Output Preview 생성, Decision Card 발행 |
| `generateDocumentation()` | documentation | 문서 3종 생성, HTML 시각화 탭 표시 |
| `startDevelopment()` | development | 봇 생성 및 실행 (현재 시뮬레이션) |
| `startReview()` | review | 결과 검증, 보고서 Decision Card 발행 |

**현재 상태:** 상태 머신 로직 완성. Phase 4의 실제 SdkExecutor 연동은 **미구현** (setTimeout 시뮬레이션).

### 5.2 ChatManager — 메시지 및 상태 관리

**책임:** 채팅 메시지 CRUD, WebSocket 브로드캐스트, Decision Card 관리, JSON 영속화

**저장 구조:**

```json
// .claudebot/chat.json
{
  "version": 1,
  "workflow": {
    "step": "development",
    "topic": "Stripe 결제",
    "activeBots": [{ "name": "Developer Bot", "status": "working", ... }],
    "decisions": [{ "id": "...", "type": "proposal", "status": "approved", ... }],
    "startedAt": "2025-01-01T00:00:00Z"
  },
  "messages": [
    { "id": "abc12345", "role": "orchestrator", "content": "안녕하세요!", ... }
  ]
}
```

**핵심 동작:**
- 모든 메시지/상태 변경 시 `chat.json` 즉시 저장 (서버 재시작 후 복원)
- WebSocket 클라이언트에 `WSServerMessage` 타입별 브로드캐스트
- 초기 연결 시 최근 50개 메시지 + 현재 workflow 상태 전송

### 5.3 SdkExecutor — Agent SDK 래퍼

**책임:** `@anthropic-ai/claude-agent-sdk`의 `query()` 함수를 래핑하여 봇 실행

**실행 흐름:**

```
1. AbortController 생성 (taskTimeoutMs)
2. config → sdkOptions 매핑:
   ├── maxTurnsPerTask → maxTurns
   ├── maxBudgetPerTaskUsd → maxBudgetUsd
   ├── model, permissionMode, allowedTools
   └── systemPromptPrefix → prompt 앞에 prepend
3. query({ prompt, options }) → async generator
4. 이벤트 처리:
   ├── system/init → sessionId 캡처
   └── result → cost, duration, text 캡처
5. TaskResult 반환 + callbacks.onCost() 호출
6. AbortError → { success: false, result: 'Task timed out' }
```

**매핑 규칙:**

| ClaudeBotConfig | Agent SDK Option | 비고 |
| --------------- | ---------------- | ---- |
| `model` | `model` | 직접 전달 |
| `maxTurnsPerTask` | `maxTurns` | 이름 변경 |
| `maxBudgetPerTaskUsd` | `maxBudgetUsd` | 이름 변경 |
| `permissionMode` | `permissionMode` | `'bypassPermissions'` → `allowDangerouslySkipPermissions: true` |
| `allowedTools` | `allowedTools` | 직접 전달 |
| `systemPromptPrefix` | prompt prepend | `prefix + '\n\n' + prompt` |

### 5.4 BotComposer — 봇 동적 생성 (미구현)

**책임:** Phase별로 필요한 봇을 동적으로 생성하고 SdkExecutor를 통해 실행

**설계:**

```typescript
// 구현 예정 — dashboard/src/server/services/bot-composer.ts
interface BotSpec {
  name: string;               // "Developer Bot", "Reviewer Bot"
  role: string;               // 역할 설명
  systemPrompt: string;       // 봇별 시스템 프롬프트
  config: Partial<ClaudeBotConfig>;  // 봇별 설정 오버라이드
  tasks: string[];            // 할당할 Task 목록
}

class BotComposer {
  constructor(
    private executor: IExecutor,
    private chatManager: ChatManager,
  ) {}

  // Phase 1 합의 기반으로 봇 생성
  createBotTeam(specs: BotSpec[]): Bot[];

  // Phase 4 동적 추가
  spawnBot(spec: BotSpec): Bot;

  // 병렬 실행
  executeParallel(bots: Bot[], tasks: Task[]): Promise<TaskResult[]>;
}
```

**Hub-Spoke 통신 구현:**
- 각 봇의 출력은 `ChatManager`를 통해 `channel: 'internal'`로 기록
- ClaudeBot(WorkflowEngine)이 봇 출력을 해석하여 `channel: 'main'`에 사용자 메시지로 변환
- 봇 간 메시지 전달: Reviewer → ClaudeBot → Developer (직접 통신 금지)

---

## 6. 통신 아키텍처

### 6.1 이중 실시간 채널

| 채널 | 프로토콜 | 용도 | 재연결 |
| ---- | -------- | ---- | ------ |
| 채팅 | WebSocket `ws://localhost:3001/api/chat/ws` | 메시지 송수신, 봇 상태, Decision Card | 지수 백오프 1s→30s |
| 파일 감시 | SSE `GET /api/events` | config 변경, .claudebot/ 파일 변경 | 지수 백오프 1s→30s |

### 6.2 REST API (WebSocket 폴백 + 초기 로드)

| Method | Endpoint | 설명 |
| ------ | -------- | ---- |
| GET | `/api/chat/messages` | 전체 메시지 조회 |
| GET | `/api/chat/workflow` | 현재 워크플로우 상태 |
| GET | `/api/chat/decisions` | 미해결 Decision Card 목록 |
| POST | `/api/chat/send` | 메시지 전송 (WS 폴백) |
| POST | `/api/chat/decision` | Decision Card 응답 |
| POST | `/api/chat/reset` | 채팅 + 워크플로우 초기화 |
| GET | `/api/project` | 현재 프로젝트 정보 |
| POST | `/api/project` | 프로젝트 설정 (폴더 선택) |
| GET | `/api/events` | SSE 스트림 |
| GET | `/api/sessions` | 세션 기록 |
| GET | `/api/summary` | 대시보드 요약 |
| GET | `/api/config` | 설정 조회 |
| GET | `/api/report` | HTML 보고서 |
| GET | `/api/tasks` | Task 목록 (현재 stub) |

### 6.3 메시지 큐

```typescript
// WorkflowEngine 내부 구현 예정
interface MessageQueue {
  enqueue(msg: QueuedMessage): void;
  process(): Promise<void>;
}

interface QueuedMessage {
  priority: 1 | 2 | 3 | 4;  // P1:사용자 > P2:에러 > P3:완료 > P4:진행보고
  source: string;             // 'user' | botName
  content: string;
  timestamp: string;
}
```

**동작:** 사용자 메시지(P1) 도착 시 → 현재 처리 중인 봇 응답 큐에 대기 → 사용자 메시지 우선 처리 → 큐 순서대로 재개

---

## 7. 데이터 저장

### 7.1 파일 기반 (DB 없음)

| 파일 | 위치 | 내용 | 쓰기 주체 |
| ---- | ---- | ---- | --------- |
| `chat.json` | `.claudebot/` | 채팅 기록 + 워크플로우 상태 | ChatManager |
| `sessions.json` | `.claudebot/` | 봇 실행 세션 기록 | BotComposer (미구현) |
| `claudebot.config.json` | 프로젝트 루트 | 사용자 설정 | 사용자 수동 편집 |

### 7.2 Config 스키마

```json
{
  "maxTotalBudgetUsd": 5.0,
  "autoOnboarding": false,
  "model": "claude-sonnet-4-6"
}
```

| 필드 | 타입 | 기본값 | 설명 |
| ---- | ---- | ------ | ---- |
| `maxTotalBudgetUsd` | number | `5.0` | 전역 예산 한도 (USD) |
| `autoOnboarding` | boolean | `false` | Epic 자동 연속 실행 (Auto-Pilot) |
| `model` | string | 최신 Sonnet | 봇 기본 모델 |
| `permissionMode` | string | `"acceptEdits"` | Agent SDK 권한 모드 |
| `maxBudgetPerTaskUsd` | number | — | 봇 당 예산 한도 |
| `maxTurnsPerTask` | number | — | 봇 당 최대 턴 수 |
| `taskTimeoutMs` | number | `600000` | 봇 실행 타임아웃 (ms) |

---

## 8. Phase별 기술 상세

### 8.1 Phase 1: Onboarding

```
사용자가 프로젝트 폴더 선택
    │
    ▼
WorkflowEngine.initializeProject(projectPath)
    ├── fileReader.readAgentsMd()         → AGENTS.md 파싱
    ├── fileReader.scanDocsFolder()       → docs/*.md (최대 10개)
    ├── fileReader.readConfig()           → claudebot.config.json
    ├── chatManager.addMessage('orchestrator', 인사메시지)
    └── chatManager.setStep('onboarding')
    │
    ▼
자유 대화 루프 (handleOnboardingChat)
    ├── 사용자 메시지 → generateConversationalResponse()
    ├── 진행 키워드 감지 → ['다음', 'next', '준비', 'ready', '진행', 'proceed']
    └── Bot Team 제안 → Decision Card (type: 'proposal')
    │
    ▼
사용자 승인 → handleProposalDecision() → setStep('prediction')
```

### 8.2 Phase 2: Prediction

```
generatePrediction()
    ├── 온보딩 대화 컨텍스트 분석
    ├── HTML Output Preview 생성
    │   ├── ① 예상 아키텍처 다이어그램
    │   ├── ② 사용자 관점 핵심 흐름
    │   └── ③ 완료 기준 체크리스트
    └── Decision Card (type: 'prediction') 발행
    │
    ▼
사용자 승인 → handlePredictionDecision() → setStep('documentation')
```

**HTML Preview 렌더링:** ChatPage에서 Decision Card의 description 필드에 포함된 HTML을 `dangerouslySetInnerHTML` 또는 iframe sandbox로 렌더링.

### 8.3 Phase 3: Documentation

```
generateDocumentation()
    ├── Doc Writer Bot 생성 (BotComposer)
    ├── 문서 3종 생성:
    │   ├── docs/PRD-{topic}.md
    │   ├── docs/TechSpec-{topic}.md
    │   └── docs/Tasks-{topic}.md
    ├── 생성된 문서를 HTML 탭으로 시각화
    │   ├── PRD 탭: 사용자 스토리, 비기능 요구사항
    │   ├── TechSpec 탭: API 엔드포인트, 스키마 변경
    │   └── Tasks 탭: 실행 작업 체크리스트
    └── 사용자에게 채팅으로 피드백/승인 요청
    │
    ▼
사용자 채팅 승인 → setStep('development')
```

### 8.4 Phase 4: Development

```
startDevelopment()
    ├── Bot Team 생성 (BotComposer.createBotTeam)
    │   ├── Developer Bot × N (병렬 가능)
    │   ├── Reviewer Bot (읽기 전용)
    │   └── 필요시 동적 추가 (Tester Bot 등)
    ├── Task 분배 및 병렬 실행
    │   ├── 독립 Task → 동시 실행
    │   └── 의존 Task → 순차 실행
    ├── Hub-Spoke 통신
    │   ├── 봇 출력 → ChatManager (internal channel)
    │   ├── ClaudeBot 해석 → 사용자 메시지 (main channel)
    │   └── Reviewer 피드백 → ClaudeBot → Developer 전달
    ├── Goal Drift 감지
    │   ├── 봇 출력의 파일 변경 범위 분석
    │   └── Task 범위 이탈 시 경고 + 복귀
    └── 진행 상황 → BotStatusDTO 브로드캐스트
    │
    ▼
모든 Task 완료 → setStep('review')
```

**봇 실행 호출:**

```typescript
// BotComposer 내부 (구현 예정)
const result = await this.executor.execute({
  prompt: `${bot.systemPrompt}\n\n## Task\n${task.description}`,
  config: {
    ...projectConfig,
    ...bot.config,   // 봇별 오버라이드
    cwd: projectPath,
  },
  callbacks: {
    onCost: (cost, sessionId) => {
      this.chatManager.broadcastBots(this.getActiveBots());
    },
    onProgress: (event, data) => {
      // 실시간 진행 상황 → internal channel
    },
  },
});
```

### 8.5 Phase 5: Review

```
startReview()
    ├── Review Bot 생성
    ├── 결과 검증:
    │   ├── 각 Task 완료 여부
    │   ├── 코드 보안 검토
    │   └── 목표 대비 달성도
    ├── 결과 보고서 생성:
    │   ├── 완료 작업 목록 + Pass/Fail
    │   ├── 비용/시간 요약
    │   ├── 코드 변경 파일 목록
    │   └── 미완료 항목
    └── Decision Card (type: 'review') 발행
    │
    ▼
사용자 최종 승인 → setStep('completed')
```

### 8.6 Epic Cycle

```
completed 상태 진입
    │
    ▼
코드베이스 재분석 (AGENTS.md, docs/, TODO 주석)
    │
    ▼
다음 Epic 후보 3개 제안 (Decision Card)
    │
    ├── autoOnboarding: false → 수동 선택 대기
    └── autoOnboarding: true  → #1 후보 자동 선정
    │
    ▼
workflow 초기화 (epic 카운터 증가)
    │
    ▼
setStep('onboarding') → 다음 사이클 시작
    │
    ▼
반복 (잔여 예산 ≥ 예상 비용 AND 사용자 미중단)
```

---

## 9. 프론트엔드 컴포넌트 구조

### 9.1 페이지

| 페이지 | 경로 | 상태 |
| ------ | ---- | ---- |
| ChatPage | `/chat` | ✅ 완성 (318줄) — 메인 UI |
| DashboardPage | `/` | ✅ 완성 |
| SessionsPage | `/sessions` | ✅ 완성 |
| AnalyticsPage | `/analytics` | ✅ 완성 |
| ConfigPage | `/config` | ✅ 완성 |
| TasksPage | `/tasks` | ⬜ Stub |
| ProjectSelectPage | `/project` | ✅ 완성 |

### 9.2 ChatPage 상태 관리

```typescript
// ChatPage.tsx 내부 state
const [messages, setMessages] = useState<ChatMessageDTO[]>([]);
const [workflow, setWorkflow] = useState<WorkflowStateDTO | null>(null);
const [bots, setBots] = useState<BotStatusDTO[]>([]);
const [pendingDecisions, setPendingDecisions] = useState<DecisionCardDTO[]>([]);
const [notifications, setNotifications] = useState<Notification[]>([]);
```

**초기 로드:** `Promise.all([GET /chat/messages, GET /chat/workflow, GET /chat/decisions])`

**실시간 업데이트:** `useWebSocket` → `onMessage` 콜백에서 `WSServerMessage.type` 별 분기 처리

**Optimistic UI:** 사용자 메시지 전송 시 로컬 state에 즉시 추가 → WS/REST로 서버 전송

### 9.3 핵심 컴포넌트

| 컴포넌트 | 역할 |
| -------- | ---- |
| `WorkflowBar` | Phase 진행률 표시, Epic 카운터, Auto-Pilot 표시 |
| `ChatTimeline` | 메시지 타임라인 렌더링 (orchestrator/user/bot/system) |
| `DecisionCard` | 승인/수정/거절 버튼, HTML 프리뷰 |
| `BotStatusPanel` | 활성 봇 목록 + 작업 요약 |
| `ChatInput` | 메시지 입력, Enter 전송, Shift+Enter 줄바꿈 |
| `NotificationToast` | 이벤트 알림 (봇 완료, 에러 등) |
| `BudgetGauge` | 예산 게이지 (사용량/한도) |

---

## 10. 빌드 및 실행

### 10.1 개발 모드

```bash
npm run dev
# → concurrently:
#   1. tsx watch dashboard/src/server/index.ts  (Fastify :3001)
#   2. vite dev                                  (React :5173)
```

Vite dev server가 `/api/*` 요청을 Fastify로 프록시.

### 10.2 프로덕션 빌드

```bash
npm run build
# → 1. tsc (src/ → dist/)
# → 2. vite build (client → dashboard/dist/client/)
# → 3. tsc -p dashboard/tsconfig.server.json (server → dashboard/dist/)

npm start
# → node dashboard/dist/server/index.js
# → Fastify가 static 미들웨어로 client 빌드 서빙
```

### 10.3 TypeScript 구성 (3개 독립 tsconfig)

| tsconfig | 대상 | module | 특이사항 |
| -------- | ---- | ------ | -------- |
| `/tsconfig.json` | `src/` → `dist/` | Node16 | root 코어 |
| `/dashboard/tsconfig.json` | `src/client/` + `src/shared/` | ESNext (bundler) | noEmit, jsx, `@shared/*` alias |
| `/dashboard/tsconfig.server.json` | `src/server/` + `src/shared/` | Node16 | `dist/` 출력 |

---

## 11. 구현 현황 및 갭 분석

| 영역 | 상태 | 갭 |
| ---- | ---- | --- |
| SdkExecutor | ✅ 완성 | — |
| Config (Zod) | ✅ 완성 | `autoOnboarding` 필드 미반영 |
| ChatManager | ✅ 완성 | — |
| Watcher (SSE) | ✅ 완성 | — |
| WorkflowEngine FSM | ✅ 완성 | Phase 4 실행이 setTimeout 시뮬레이션 |
| REST + WebSocket API | ✅ 완성 | — |
| ChatPage UI | ✅ 완성 | — |
| **BotComposer** | ⬜ 미구현 | Phase 4 핵심 — 봇 동적 생성/실행 |
| **MessageQueue** | ⬜ 미구현 | P1~P4 우선순위 큐 |
| **Goal Drift 감지** | ⬜ 미구현 | 봇 출력 범위 분석 로직 |
| **Epic Cycle** | ⬜ 미구현 | completed → 재분석 → 다음 Epic 선정 |
| **sessions.json 쓰기** | ⬜ 미구현 | 비용/세션 기록 영속화 |
| **HTML Preview 렌더링** | ⬜ 미구현 | Phase 2 HTML iframe/inline 렌더링 |
| **TasksPage** | ⬜ Stub | 대화 기반 Task 추적 |
| `withRetry` 연동 | ⬜ 미사용 | SDK 호출 재시도 미적용 |

---

## 12. 구현 우선순위 (로드맵 기준)

| 순서 | 마일스톤 | 핵심 작업 | 의존성 |
| ---- | -------- | --------- | ------ |
| 1 | v0.3 | HTML Output Preview 렌더링 (Phase 2) | — |
| 2 | v0.4 | BotComposer + SdkExecutor 연동 | v0.3 |
| 3 | v0.5 | Phase 4 실제 봇 실행 + 병렬 처리 | v0.4 |
| 4 | v0.5 | MessageQueue (P1~P4 우선순위) | v0.4 |
| 5 | v0.6 | Phase 5 Review Bot + 보고서 | v0.5 |
| 6 | v0.6 | Goal Drift 감지 | v0.5 |
| 7 | v0.6 | sessions.json 영속화 + 비용 추적 | v0.5 |
| 8 | v0.7 | Epic Cycle + Auto-Pilot | v0.6 |
| 9 | v0.7 | config에 `autoOnboarding` Zod 필드 추가 | v0.7 |
| 10 | v1.0 | 전체 통합 테스트 + 안정화 | v0.7 |
