# ClaudeBot 기술 명세서

> 버전: 0.1.0 — 최종 업데이트: 2026-02-28

---

## 1. 개요

**ClaudeBot**은 자율적인 큐 기반 태스크 오케스트레이터로, Claude를 대화형 어시스턴트에서 벗어나 백그라운드에서 지속적으로 실행되는 능동적이고 목표 지향적인 에이전트로 전환합니다.

**핵심 철학:** _AI와 단순히 대화하는 것을 멈추고, 위임을 시작하라._

태스크는 파일(예: `tasks.md`) 내 마크다운 체크박스로 정의됩니다. ClaudeBot은 큐를 읽고, Claude를 사용하여 각 태스크를 실행하며, 결과를 파일에 직접 표시(`[x]` 또는 `[!]`)하고, 무인 상태로 계속 진행합니다.

**핵심 차별점:** 하이브리드 이중 엔진 설계를 통해 Anthropic API 키(SDK 엔진) 또는 Claude Max 구독(CLI 엔진) 중 하나를 선택하여 과금할 수 있으며, 동일한 태스크 큐 동작을 제공합니다.

---

## 2. 아키텍처 개요

```
┌─────────────────────────────────────────────────────────────┐
│              src/index.ts  (Commander CLI)                  │
│   run command ──────────────────► ClaudeBot.run()           │
│   status command ───────────────► SessionManager.getStore() │
└────────────────────┬────────────────────────────────────────┘
                     │
          ┌──────────▼──────────┐
          │   src/config.ts     │  Zod 검증 설정
          │   src/bot.ts        │  오케스트레이션 루프
          └──────┬────────┬─────┘
                 │        │
    ┌────────────▼──┐  ┌──▼────────────┐
    │  Task Parser  │  │  Task Writer  │
    │ parser.ts     │  │  writer.ts    │
    └────────────┬──┘  └──────────────┘
                 │
    ┌────────────▼──────────────────────┐
    │         Engine Factory            │
    │         factory.ts                │
    └────────┬──────────────────┬───────┘
             │                  │
  ┌──────────▼──────┐  ┌────────▼──────────┐
  │  SDK Executor   │  │   CLI Executor    │
  │  sdk-executor.ts│  │  cli-executor.ts  │
  │                 │  │                   │
  │ query() async   │  │ spawn('claude')   │
  │ 정확한 비용     │  │ stream-json 파싱  │
  │ 네이티브 서브에이전트│  │ Max 구독         │
  │ API Key 과금    │  │ 비용 추적 불가    │
  └──────────┬──────┘  └────────┬──────────┘
             └────────┬─────────┘
                      │
          ┌───────────▼───────────────┐
          │    결과 처리              │
          │  SessionManager.record()  │
          │  CostTracker.record()     │
          │  writer.updateTaskInFile()│
          └───────────────────────────┘
                      │
          ┌───────────▼───────────────┐
          │   영속 스토리지           │
          │  .claudebot/sessions.json │
          │  tasks.md (체크박스 상태) │
          └───────────────────────────┘
```

---

## 3. 기술 스택

| 구성 요소         | 기술                               | 버전     |
|-------------------|------------------------------------|----------|
| 언어              | TypeScript (ESM, strict 모드)      | ^5.7.0   |
| 런타임            | Node.js                            | >=18.0.0 |
| 주요 엔진         | @anthropic-ai/claude-agent-sdk     | ^0.2.62  |
| CLI 프레임워크    | Commander.js                       | ^13.1.0  |
| 로깅              | 커스텀 콘솔 래퍼 (Pino 인터페이스 호환) | —        |
| 설정 검증         | Zod                                | ^4.0.0   |
| 모듈 시스템       | ES2022, Node16 resolution          | —        |
| 빌드 도구         | tsc (TypeScript 컴파일러)          | —        |
| 개발용 실행기     | tsx                                | ^4.19.0  |

---

## 4. 핵심 컴포넌트

### 4.1 CLI 진입점 — [src/index.ts](../src/index.ts)

Commander.js 기반 CLI로, 세 가지 명령어를 제공합니다.

#### `claudebot run`

큐에 있는 모든 대기 중인 태스크를 실행합니다.

| 플래그 | 타입 | 기본값 | 설명 |
|------|------|---------|-------------|
| `-f, --file <path>` | string | 설정값 | 태스크 마크다운 파일 경로 |
| `-c, --cwd <path>` | string | `process.cwd()` | 작업 디렉토리 |
| `-m, --model <name>` | string | `claude-sonnet-4-6` | Claude 모델 ID |
| `-e, --engine <type>` | `sdk\|cli` | `sdk` | 실행 엔진 |
| `--max-retries <n>` | number | 2 | 태스크당 최대 재시도 횟수 |
| `--max-budget <usd>` | number | 20.00 | 총 예산 한도 (USD) |
| `--timeout <ms>` | number | 600000 | 태스크당 타임아웃 (ms) |
| `--stop-on-failure` | flag | false | 첫 번째 실패 시 큐 중단 |
| `--permission-mode <mode>` | string | `acceptEdits` | Claude 권한 모드 |
| `--log-level <level>` | string | `info` | 로그 상세도 |
| `--watch-interval <ms>` | number | 20000 | 와치 모드 폴링 간격 |
| `--dry-run` | flag | false | 태스크 파싱만, 실행 안 함 |

SIGINT/SIGTERM 핸들러를 등록하여 정상 종료를 위해 `bot.abort()`를 호출합니다.

#### `claudebot swarm`

멀티봇 BotGraph 스웜을 실행합니다.

| 플래그 | 타입 | 기본값 | 설명 |
|------|------|---------|-------------|
| `--config <path>` | string | `claudebot.swarm.json` | 스웜 설정 파일 경로 |
| `--log-level <level>` | string | `info` | 로그 상세도 |
| `--dry-run` | flag | false | config 유효성 검사 및 봇 토폴로지만 표시 |

#### `claudebot status`

`.claudebot/sessions.json`을 읽어 다음 정보를 출력합니다:

- 누적 총 비용 (USD)
- 총 태스크 수
- 최근 10개의 세션 레코드 (줄 번호, 상태, 비용, 소요 시간, 프롬프트 요약)

| 플래그 | 타입 | 기본값 | 설명 |
|------|------|---------|-------------|
| `--swarm` | flag | false | 봇별 스웜 비용 요약 표시 |

---

### 4.2 설정 — [src/config.ts](../src/config.ts)

**파일 탐색 순서:** `claudebot.config.json` → `claudebot.config.js` → `claudebot.config.ts` (`process.cwd()` 기준).

**Zod 스키마 및 기본값:**

```typescript
{
  engine: 'sdk' | 'cli'               // 기본값: 'sdk'
  tasksFile: string                    // 기본값: 'docs/todo.md'
  cwd: string                          // 기본값: process.cwd()
  model?: string                       // 기본값: undefined (SDK 기본값 사용)
  permissionMode: 'default'            // 기본값: 'acceptEdits'
               | 'acceptEdits'
               | 'bypassPermissions'
  maxBudgetPerTaskUsd?: number         // 기본값: undefined (태스크당 한도 없음)
  maxTotalBudgetUsd?: number           // 기본값: undefined (전체 한도 없음)
  taskTimeoutMs: number                // 기본값: 600_000 (10분)
  maxRetries: number                   // 기본값: 2
  stopOnFailure: boolean               // 기본값: false
  sessionStorePath: string             // 기본값: '.claudebot/sessions.json'
  logLevel: 'debug'|'info'|'warn'|'error' // 기본값: 'info'
  watchIntervalMs: number              // 기본값: 20_000 (20초)
  swarm?: SwarmConfig                  // 선택적 스웜 설정
}
```

CLI 플래그는 파일 설정 위에 병합됩니다 (CLI 플래그가 우선).

---

### 4.3 봇 오케스트레이터 — [src/bot.ts](../src/bot.ts)

**클래스:** `ClaudeBot`

**생성자:** `new ClaudeBot(config: ClaudeBotConfig, logger: Logger)`

내부적으로 다음을 생성합니다:

- `IExecutor` — `createExecutor(config.engine)` 호출
- `SessionManager` — 영속 기록용
- `CostTracker` — 예산 집행용
- `AbortController` — 정상 종료용

#### 메서드

| 메서드 | 시그니처 | 설명 |
|--------|-----------|-------------|
| `run()` | `(): Promise<BotRunResult>` | 주 진입점. 모든 대기 태스크를 실행합니다. |
| `abort()` | `(): void` | 종료 신호 전송. 현재 태스크 완료 후 큐 정지. |
| `executeWithRetry()` | `(task): Promise<TaskResult>` | 지수 백오프로 executor를 래핑합니다. |
| `sleep()` | `(ms): Promise<void>` | 와치 모드 폴링을 위한 중단 인식 슬립. |

#### 태스크 실행 루프

```
parseTasks(tasksFile)
  → 대기 중인 태스크 필터링
  → 각 태스크에 대해:
      예산 확인 → 한도 초과 시 건너뜀
      executeWithRetry(task)
        → executor.execute(task, config, logger)
        → 실패 시: 지수 백오프, 최대 maxRetries 재시도
      updateTaskInFile(task, result)   // [x] 또는 [!]
      sessionManager.record(result)
      costTracker.record(result.costUsd)
  → 대기 태스크 없음 && 와치 모드: sleep(watchIntervalMs), 루프
```

#### 반환 타입: `BotRunResult`

```typescript
{
  totalTasks: number;
  completed: number;
  failed: number;
  skipped: number;
  totalCostUsd: number;
  totalDurationMs: number;
  results: TaskResult[];
}
```

---

### 4.4 실행 엔진

#### IExecutor 인터페이스 — [src/engine/types.ts](../src/engine/types.ts)

```typescript
interface IExecutor {
  readonly engineType: 'sdk' | 'cli';
  execute(
    task: Task,
    config: ClaudeBotConfig,
    logger: Logger,
    callbacks?: ExecutorCallbacks,
  ): Promise<TaskResult>;
}

interface ExecutorCallbacks {
  onCost?: (costUsd: number) => void;
  onProgress?: (text: string) => void;
}
```

#### SDK Executor — [src/engine/sdk-executor.ts](../src/engine/sdk-executor.ts) ✅ 작동 중

**과금:** Anthropic API Key (토큰당 과금)
**비용 추적:** 정확한 값 (`SDKResultMessage.total_cost_usd`)

**실행 흐름:**

1. `taskTimeoutMs` 데드라인으로 `AbortController` 생성
2. `AgentSDKOptions` 구성:
   - `model` (설정 또는 태스크 태그에서)
   - `maxTurns` (태스크 태그에서 또는 undefined)
   - `permissionMode` (설정에서)
   - `agents` (스웜 설정이 있을 경우)
3. `query(prompt, options)` 호출 — 비동기 제너레이터 반환
4. 제너레이터에서 메시지 순회:
   - `type: 'system', subtype: 'init'` → `session_id` 캡처
   - `type: 'result'` → `total_cost_usd`, `duration_ms`, `is_error` 캡처
5. 정확한 비용이 포함된 `TaskResult` 반환

**검증 완료:** 2026-02-27에 태스크 2개 성공적으로 실행 (총 $0.1094).

#### CLI Executor — [src/engine/cli-executor.ts](../src/engine/cli-executor.ts) ✅ 작동 중

**과금:** Claude Max 구독 (정액 요금)
**비용 추적:** 불가능 (`-1` 반환)

**실행 흐름:**

1. CLI 인수 구성: `-p <prompt> --output-format stream-json --verbose [--model] [--max-turns] [--permission-mode]`
2. `spawn('claude', args)` — TTY 멈춤 방지를 위해 stdin 즉시 닫기
3. stdout에서 개행 구분 JSON 파싱:
   - `type: 'system', subtype: 'init'` → `session_id` 캡처
   - `type: 'result'` → `is_error`, `cost_usd` 캡처
4. 프로세스 종료 코드 처리
5. `AbortController` 타임아웃 적용

**검증 완료:** 2026-02-27 ~ 2026-02-28에 태스크 8개 성공적으로 실행 (CLI 구독 총 ~$0.586).

#### Engine Factory — [src/engine/factory.ts](../src/engine/factory.ts)

```typescript
function createExecutor(engine: 'sdk' | 'cli'): IExecutor
```

단순 팩토리 함수 — 설정에 따라 `SdkExecutor` 또는 `CliExecutor`를 반환합니다.

---

### 4.5 태스크 시스템

#### 파서 — [src/task/parser.ts](../src/task/parser.ts)

**정규식:** `^(\s*[-*]\s*)\[([ xX!])\]\s+(.+)$`

**체크박스 상태:**

| 마커 | 상태 | 동작 |
|--------|--------|----------|
| `[ ]` | 대기 중 | 파싱 후 실행 큐에 추가 |
| `[x]` 또는 `[X]` | 완료됨 | 건너뜀 |
| `[!]` | 실패함 | 건너뜀 |

**인라인 태그** (실행 전 프롬프트에서 제거됨):

| 태그 | 필드 | 예시 |
|-----|-------|---------|
| `[cwd:path]` | `task.cwd` | `[cwd:src/utils]` |
| `[budget:n]` | `task.maxBudgetUsd` | `[budget:0.50]` |
| `[turns:n]` | `task.maxTurns` | `[turns:10]` |
| `[agent:name]` | `task.agent` | `[agent:developer]` |

**태스크 객체:**

```typescript
interface Task {
  line: number;          // 파일 내 1-indexed 줄 번호 (쓰기 복귀용)
  rawText: string;       // 원본 줄 내용
  prompt: string;        // 정제된 텍스트 (태그 제거됨)
  status: TaskStatus;    // 'pending' | 'running' | 'completed' | 'failed' | 'skipped'
  cwd?: string;
  maxBudgetUsd?: number;
  maxTurns?: number;
  agent?: string;
  retryCount: number;
  tags: Record<string, string>;
}
```

#### 라이터 — [src/task/writer.ts](../src/task/writer.ts)

각 실행 후 태스크 파일을 제자리에서 업데이트합니다:

- **완료:** `[ ]` → `[x]`
- **실패:** `[ ]` → `[!]` + `<!-- FAILED: retry N -->` 주석 추가
- **줄 끝 보존:** CRLF vs LF를 감지하여 원본 형식 유지

---

### 4.6 세션 관리 — [src/session/manager.ts](../src/session/manager.ts)

**저장 경로:** `.claudebot/sessions.json` (`sessionStorePath`로 변경 가능)

**SessionStore 형식:**

```json
{
  "version": 1,
  "projectCwd": "/path/to/project",
  "totalCostUsd": 0.69503695,
  "records": [...]
}
```

**SessionRecord 스키마:**

```typescript
interface SessionRecord {
  taskLine: number;
  taskPrompt: string;
  sessionId: string;
  costUsd: number;
  durationMs: number;
  status: TaskStatus;
  timestamp: string;    // ISO 8601
  retryCount: number;
  engine: 'sdk' | 'cli';
}
```

초기화 시 자동 로드, `recordResult()` 호출 후 자동 저장.

---

### 4.7 비용 추적기 — [src/cost/tracker.ts](../src/cost/tracker.ts)

현재 실행 세션을 위한 인메모리 추적기입니다.

```typescript
class CostTracker {
  record(costUsd: number): void;
  isOverBudget(): boolean;          // config.maxTotalBudgetUsd에 대해 확인
  remainingBudget(): number | null;
  getSummary(): CostSummary;
}

interface CostSummary {
  totalCostUsd: number;
  taskCount: number;
  averageCostPerTask: number;
  costByModel: Record<string, number>;
  costByBot: Record<string, number>;
  totalInputTokens: number;
  totalOutputTokens: number;
}
```

예산 집행: `bot.ts`는 각 태스크 전에 `isOverBudget()`을 호출합니다. 초과 시 나머지 태스크는 `skipped`로 표시됩니다.

---

### 4.8 유틸리티

#### AbortController 래퍼 — [src/utils/abort.ts](../src/utils/abort.ts)

```typescript
function createAbortController(timeoutMs?: number): {
  controller: AbortController;
  cleanup: () => void;   // 타임아웃 타이머 해제
}
```

데드라인에 `controller.abort()`를 호출하는 `setTimeout`을 설정합니다. 메모리 누수 방지를 위해 태스크 완료 후 반드시 `cleanup()`을 호출해야 합니다.

#### 재시도 래퍼 — [src/utils/retry.ts](../src/utils/retry.ts)

```typescript
function withRetry<T>(
  fn: () => Promise<T>,
  shouldRetry: (error: unknown, result?: T) => boolean,
  opts?: RetryOptions,
): Promise<T>

interface RetryOptions {
  maxRetries: number;
  baseDelayMs: number;   // 기본값: 1000
  maxDelayMs: number;    // 기본값: 30_000
  logger?: Logger;
}
```

**백오프 공식:** `delay = min(baseDelayMs × 2^attempt, maxDelayMs)`

---

### 4.9 멀티 에이전트 스웜 — [src/agent/swarm.ts](../src/agent/swarm.ts)

> **상태:** 프레임워크 정의 완료. 주 실행 루프에 아직 통합되지 않음.

Agent SDK의 네이티브 `agents` 옵션 사용 — 외부 메시지 브로커(Redis, SQLite) 불필요.

#### 기본 파이프라인: Manager → Developer + QA

| 에이전트 | 모델 | 도구 | 역할 |
|-------|-------|-------|------|
| Manager | Opus | Read, Grep, Glob, Task | 태스크 분해, `Task` 도구로 위임, 결과 합성 |
| Developer | Sonnet | Read, Grep, Glob, Edit, Write, Bash | 코드 변경 구현 |
| QA | Sonnet | Read, Grep, Glob, Bash | 코드 검토, 테스트 실행 — **쓰기 권한 없음** |

**동료 검토 루프:** Developer → QA 검증 → 실패 시 Manager가 Developer에게 피드백 라우팅 (최대 3회 수정 사이클).

**SwarmConfig 타입:**

```typescript
interface SwarmConfig {
  enabled: boolean;
  agents: Record<string, {
    description: string;
    prompt: string;
    tools?: string[];
    model?: 'sonnet' | 'opus' | 'haiku' | 'inherit';
    maxTurns?: number;
  }>;
  mainAgent?: string;
}
```

---

## 5. 데이터 흐름

```
사용자 실행: claudebot run

  1. loadConfig()
     └─ claudebot.config.json 읽기
     └─ CLI 플래그 병합 (우선 적용)
     └─ Zod 스키마로 검증

  2. parseTasks(config.tasksFile)
     └─ 마크다운 파일을 줄 단위로 읽기
     └─ 체크박스 정규식 매칭
     └─ 인라인 태그 추출
     └─ Task[] 반환 (대기 중인 것만)

  3. 각 Task에 대해:
     │
     ├─ costTracker.isOverBudget() → true → 건너뜀으로 표시, 계속
     │
     ├─ executor.execute(task, config, logger)
     │   ├─ [SDK] query(prompt, opts) → 비동기 제너레이터
     │   │   ├─ 메시지: init → session_id
     │   │   └─ 메시지: result → cost, duration, is_error
     │   │
     │   └─ [CLI] spawn('claude', args) → stdout 스트림
     │       ├─ 줄: init JSON → session_id
     │       └─ 줄: result JSON → cost, is_error
     │
     ├─ writer.updateTaskInFile(task, result)
     │   ├─ 성공 → [ ] → [x]
     │   └─ 실패 → [ ] → [!] + 주석
     │
     ├─ sessionManager.record(result)
     │   └─ sessions.json에 추가
     │
     └─ costTracker.record(result.costUsd)

  4. BotRunResult 요약 반환
```

---

## 6. 설정 레퍼런스

전체 `claudebot.config.json` 필드 레퍼런스:

| 필드 | 타입 | 기본값 | 설명 |
|-------|------|---------|-------------|
| `engine` | `"sdk" \| "cli"` | `"sdk"` | 실행 엔진 선택 |
| `tasksFile` | string | `"docs/todo.md"` | 마크다운 태스크 파일 경로 |
| `model` | string? | SDK 기본값 | Claude 모델 ID |
| `permissionMode` | string | `"acceptEdits"` | Claude 도구 권한 모드 |
| `maxBudgetPerTaskUsd` | number? | — | 태스크당 USD 한도 |
| `maxTotalBudgetUsd` | number? | — | 전체 실행 USD 한도 |
| `taskTimeoutMs` | number | `600000` | 태스크당 타임아웃 (10분) |
| `maxRetries` | number | `2` | 최대 재시도 횟수 |
| `stopOnFailure` | boolean | `false` | 첫 번째 실패 시 큐 중단 |
| `sessionStorePath` | string | `".claudebot/sessions.json"` | 세션 기록 파일 |
| `logLevel` | string | `"info"` | 로깅 상세도 |
| `watchIntervalMs` | number | `20000` | 와치 모드 폴링 간격 (20초) |
| `swarm` | object? | — | 멀티 에이전트 스웜 설정 |

---

## 7. 구현 현황

| 기능 | 상태 | 엔진 | 검증 |
|---------|--------|--------|---------|
| 태스크 큐 파싱 (체크박스 + 태그) | ✅ 작동 중 | 모두 | 태스크 10개 |
| `query()`를 통한 SDK 실행 | ✅ 작동 중 | SDK | 태스크 2개, $0.11 |
| `spawn('claude')`를 통한 CLI 실행 | ✅ 작동 중 | CLI | 태스크 8개, $0.59 |
| 세션 영속성 (sessions.json) | ✅ 작동 중 | 모두 | 레코드 10개 |
| 정확한 비용 추적 | ✅ 작동 중 | SDK 전용 | 예 |
| 예산 집행 (태스크당 + 전체) | ✅ 작동 중 | 모두 | — |
| 지수 백오프 재시도 | ✅ 작동 중 | 모두 | — |
| 태스크당 타임아웃 (AbortController) | ✅ 작동 중 | 모두 | — |
| 정상 SIGINT/SIGTERM 종료 | ✅ 작동 중 | 모두 | — |
| 드라이런 모드 (파싱, 실행 안 함) | ✅ 작동 중 | 모두 | — |
| 와치 모드 (큐 비어 있을 때 폴링) | ✅ 작동 중 | 모두 | — |
| Zod 설정 검증 | ✅ 작동 중 | 모두 | — |
| CLI `status` 명령어 | ✅ 작동 중 | 모두 | — |
| 태스크 파일 쓰기 복귀 [x] / [!] | ✅ 작동 중 | 모두 | — |
| 인라인 태그 파싱 ([budget], [turns]) | ✅ 작동 중 | 모두 | — |
| 멀티 에이전트 스웜 (SDK 네이티브 정의) | 🔧 정의됨 | SDK 전용 | 미통합 |
| BotGraph 멀티봇 파이프라인 (Phase 2) | ✅ 구현됨 | 모두 | `src/swarm/` 8개 파일 |
| `claudebot swarm` CLI 명령어 | ✅ 작동 중 | 모두 | dry-run 지원 |
| BotGraph config 검증 (Zod) | ✅ 작동 중 | 모두 | — |
| InboxManager (canContact 강제) | ✅ 작동 중 | 모두 | — |
| BulletinBoard (append-only 공유 로그) | ✅ 작동 중 | 모두 | — |
| RegistryManager (작업 상태 머신, 파일 락) | ✅ 작동 중 | 모두 | — |
| SwarmOrchestrator (N봇 병렬 실행) | ✅ 작동 중 | 모두 | — |
| `claudebot status --swarm` | ✅ 작동 중 | 모두 | 봇별 비용 집계 |
| EventBus (타입드 이벤트 시스템) | ✅ 작동 중 | 모두 | `src/events/` |
| SwarmOrchestrator `addBot()`/`removeBot()` API | ✅ 작동 중 | 모두 | 동적 봇 생성/제거 |
| WorkflowManager (4-Step 상태 머신) | ✅ 작동 중 | 모두 | `src/orchestrator/` |
| Dashboard v2 WebSocket + ChatManager | ✅ 작동 중 | 모두 | `@fastify/websocket` |
| 대화형 인터페이스 (WorkflowEngine) | ✅ 작동 중 | 모두 | 4-Step 워크플로우 UI |
| Decision Card (승인/수정/거부) | ✅ 작동 중 | 모두 | Preview + Proposal |
| HTML 결과 보고서 생성기 | ✅ 작동 중 | 모두 | `src/report/`, `/api/report` |
| 토큰 수 분석 | 🔧 플레이스홀더 | SDK | — |
| PoC 자동화 + 도메인 이탈 감지 | ❌ 미구현 | — | Phase 4.3 |
| 병렬 태스크 실행 (단일봇 내) | ❌ 미계획 | — | 순차 실행만 |

---

## 8. 알려진 한계

1. **순차 실행만 가능** — 태스크는 하나씩 실행됩니다. 병렬 실행 없음.
2. **CLI executor: 비용 추적 불가** — `costUsd`로 `-1`을 반환합니다. 예산 집행은 추정치 기반.
3. **스웜 모드 미통합** — `src/agent/swarm.ts`에서 에이전트 설정을 정의하지만, `ClaudeBot.run()`은 아직 스웜 라우팅을 활성화하지 않습니다.
4. **재시작 시 재개 불가** — 와치 모드는 재시작 시 메모리 내 태스크 상태를 초기화합니다. 세션 기록은 유지되지만, 진행 중인 태스크는 자동 재개되지 않습니다.
5. **단일 태스크 파일** — 모든 태스크는 하나의 마크다운 파일에 있어야 합니다. 다중 파일 큐 미지원.

---

## 9. 파일 구조

```
claude-bot/
├── src/
│   ├── index.ts              # CLI 진입점 (Commander)
│   ├── bot.ts                # ClaudeBot 오케스트레이터
│   ├── config.ts             # Zod 설정 로더
│   ├── types.ts              # 핵심 타입 정의
│   ├── logger/
│   │   └── index.ts          # Pino 로거 팩토리
│   ├── engine/
│   │   ├── types.ts          # IExecutor 인터페이스
│   │   ├── factory.ts        # 엔진 팩토리 함수
│   │   ├── sdk-executor.ts   # SDK 엔진 (주요)
│   │   └── cli-executor.ts   # CLI 엔진 (폴백)
│   ├── task/
│   │   ├── parser.ts         # 마크다운 태스크 파서
│   │   └── writer.ts         # 태스크 파일 업데이터
│   ├── session/
│   │   └── manager.ts        # 세션 영속성 관리
│   ├── cost/
│   │   └── tracker.ts        # 예산/비용 추적
│   ├── agent/
│   │   └── swarm.ts          # 멀티 에이전트 스웜 설정 (SDK 네이티브)
│   ├── swarm/                # BotGraph 멀티봇 파이프라인 (Phase 2)
│   │   ├── index.ts          # Barrel export
│   │   ├── types.ts          # Zod 스키마 (BotDefinition, SwarmGraphConfig 등)
│   │   ├── config-loader.ts  # claudebot.swarm.json 로더 + 유효성 검사
│   │   ├── bot-factory.ts    # BotDefinition → ClaudeBotConfig 파생
│   │   ├── orchestrator.ts   # SwarmOrchestrator (N봇 병렬, addBot/removeBot)
│   │   ├── inbox.ts          # InboxManager (봇별 inbox, canContact 강제)
│   │   ├── board.ts          # BulletinBoard (append-only 공유 로그)
│   │   ├── registry.ts       # RegistryManager (작업 상태 머신, 파일 락)
│   │   └── workspace.ts      # bootstrapWorkspace() (디렉토리 자동 생성)
│   ├── events/               # Phase 4: 타입드 이벤트 시스템
│   │   ├── index.ts          # Barrel export
│   │   └── event-bus.ts      # SwarmEventBus (싱글톤, 타입 안전 이벤트)
│   ├── orchestrator/         # Phase 4: 오케스트레이터 API
│   │   ├── index.ts          # Barrel export
│   │   ├── types.ts          # BotProposal, OutputPreview, DecisionCard 등
│   │   └── workflow.ts       # WorkflowManager (4-Step 상태 머신)
│   ├── report/               # Phase 4: HTML 결과 보고서
│   │   ├── index.ts          # Barrel export (saveReport)
│   │   └── generator.ts      # generateHtmlReport() (독립 HTML)
│   └── utils/
│       ├── abort.ts          # AbortController 헬퍼
│       └── retry.ts          # 지수 백오프 재시도
├── dashboard/                # Phase 3/5: 웹 대시보드
│   ├── src/
│   │   ├── shared/
│   │   │   └── api-types.ts  # 공유 DTO 타입 (Chat, Workflow, Bot 등)
│   │   ├── server/
│   │   │   ├── index.ts      # Fastify 서버 진입점
│   │   │   ├── services/
│   │   │   │   ├── chat-manager.ts     # WebSocket + 채팅/워크플로우 상태 관리
│   │   │   │   ├── workflow-engine.ts  # 4-Step 워크플로우 엔진 (핵심)
│   │   │   │   ├── file-reader.ts      # 프로젝트 파일 읽기
│   │   │   │   ├── task-parser.ts      # 태스크 파서
│   │   │   │   └── watcher.ts          # 파일 시스템 감시
│   │   │   └── routes/
│   │   │       ├── chat.ts       # WebSocket + REST 채팅 라우트
│   │   │       ├── project.ts    # 프로젝트 경로 관리
│   │   │       ├── report.ts     # HTML 보고서 생성
│   │   │       ├── sessions.ts   # 세션 조회
│   │   │       ├── tasks.ts      # 태스크 조회
│   │   │       ├── config.ts     # 설정 조회
│   │   │       ├── events.ts     # SSE 이벤트 스트림
│   │   │       └── summary.ts    # 요약 통계
│   │   └── client/
│   │       ├── App.tsx           # React 라우터 + 레이아웃
│   │       ├── main.tsx          # 진입점 (ProjectProvider 래핑)
│   │       ├── hooks/
│   │       │   ├── useProject.tsx   # ProjectContext (전역 상태)
│   │       │   ├── useWebSocket.ts  # WebSocket + 자동 재연결
│   │       │   ├── useApi.ts        # REST API 훅
│   │       │   └── useSSE.ts        # SSE 훅
│   │       ├── pages/
│   │       │   ├── ChatPage.tsx          # 대화형 인터페이스 (Phase 5)
│   │       │   ├── DashboardPage.tsx     # 메인 대시보드
│   │       │   ├── SessionsPage.tsx      # 세션 목록
│   │       │   ├── TasksPage.tsx         # 태스크 뷰
│   │       │   ├── ConfigPage.tsx        # 설정 뷰
│   │       │   ├── AnalyticsPage.tsx     # 분석 뷰
│   │       │   └── ProjectSelectPage.tsx # 프로젝트 선택
│   │       └── components/
│   │           ├── layout/
│   │           │   ├── Layout.tsx    # 사이드바 + 메인 레이아웃
│   │           │   └── Sidebar.tsx   # 네비게이션
│   │           └── chat/             # Phase 5 채팅 컴포넌트
│   │               ├── ChatTimeline.tsx   # 메시지 타임라인
│   │               ├── ChatInput.tsx      # 입력창 (Shift+Enter)
│   │               ├── WorkflowBar.tsx    # 5단계 진행 표시
│   │               ├── DecisionCard.tsx   # 승인/수정/거부 UI
│   │               └── BotStatusPanel.tsx # 봇 상태 패널
│   ├── vite.config.ts        # Vite + WebSocket 프록시
│   └── package.json
├── examples/
│   └── swarm-dev-team/       # 소프트웨어 개발팀 예시
│       ├── claudebot.swarm.json
│       └── prompts/          # coordinator.md, worker.md, reviewer.md
├── docs/
│   ├── PRD.md                # 제품 요구사항
│   ├── TechSpec.md           # 현재 문서
│   ├── task-adv.md           # Adv 구현 계획서
│   ├── botgraph-guide.md     # BotGraph 사용 가이드
│   ├── claude-agent-sdk-guide.md  # Agent SDK 가이드
│   ├── dashboard-plan.md     # Dashboard 설계 계획
│   └── todo.md               # 기본 태스크 큐 파일
├── tasks.md                  # 예시 태스크 큐
├── claudebot.config.json     # 프로젝트 설정 (단일봇)
├── claudebot.swarm.json      # 스웜 설정 (멀티봇, 선택)
├── build.bat                 # 빌드 + 실행 배치 파일
├── run.bat / swarm.bat / status.bat / dashboard.bat  # 실행 스크립트
├── package.json
├── tsconfig.json
└── .claudebot/
    ├── sessions.json         # 영속 세션 기록
    └── chat.json             # 대시보드 채팅 상태 (자동 생성)
```
