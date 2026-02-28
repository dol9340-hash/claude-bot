# ClaudeBot Technical Specification

> Version: 0.1.0 — Last Updated: 2026-02-28

---

## 1. Overview

**ClaudeBot** is an autonomous, queue-driven task orchestrator that transforms Claude from a conversational assistant into a proactive, goal-driven agent running continuously in the background.

**Core philosophy:** _Stop just chatting with AI, and start delegating._

Tasks are defined as markdown checkboxes in a file (e.g., `tasks.md`). ClaudeBot reads the queue, executes each task using Claude, marks results in-place (`[x]` or `[!]`), and moves on—unattended.

**Key differentiator:** Hybrid dual-engine design allows billing via either Anthropic API key (SDK engine) or Claude Max subscription (CLI engine), with identical task queue behavior.

---

## 2. Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│              src/index.ts  (Commander CLI)                  │
│   run command ──────────────────► ClaudeBot.run()           │
│   status command ───────────────► SessionManager.getStore() │
└────────────────────┬────────────────────────────────────────┘
                     │
          ┌──────────▼──────────┐
          │   src/config.ts     │  Zod-validated config
          │   src/bot.ts        │  Orchestration loop
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
  │ Exact cost      │  │ stream-json parse │
  │ Native subagents│  │ Max subscription  │
  │ API Key billing │  │ No cost tracking  │
  └──────────┬──────┘  └────────┬──────────┘
             └────────┬─────────┘
                      │
          ┌───────────▼───────────────┐
          │    Result Processing      │
          │  SessionManager.record()  │
          │  CostTracker.record()     │
          │  writer.updateTaskInFile()│
          └───────────────────────────┘
                      │
          ┌───────────▼───────────────┐
          │   Persistent Storage      │
          │  .claudebot/sessions.json │
          │  tasks.md (checkbox state)│
          └───────────────────────────┘
```

---

## 3. Technology Stack

| Component         | Technology                         | Version  |
|-------------------|------------------------------------|----------|
| Language          | TypeScript (ESM, strict mode)      | ^5.7.0   |
| Runtime           | Node.js                            | >=18.0.0 |
| Primary Engine    | @anthropic-ai/claude-agent-sdk     | ^0.2.62  |
| CLI Framework     | Commander.js                       | ^13.1.0  |
| Logging           | Pino + pino-pretty                 | ^9.6.0   |
| Config Validation | Zod                                | ^4.0.0   |
| Module System     | ES2022, Node16 resolution          | —        |
| Build Tool        | tsc (TypeScript compiler)          | —        |
| Dev Runner        | tsx                                | ^4.19.0  |

---

## 4. Core Components

### 4.1 CLI Entry Point — [src/index.ts](../src/index.ts)

Commander.js-based CLI with two commands.

#### `claudebot run`

Executes all pending tasks in the queue.

| Flag | Type | Default | Description |
|------|------|---------|-------------|
| `-f, --file <path>` | string | config value | Tasks markdown file path |
| `-c, --config <path>` | string | auto-detected | Config file path |
| `-m, --model <name>` | string | `claude-sonnet-4-6` | Claude model ID |
| `-e, --engine <type>` | `sdk\|cli` | `sdk` | Execution engine |
| `--max-retries <n>` | number | 2 | Max retry attempts per task |
| `--max-budget <usd>` | number | 20.00 | Total budget limit (USD) |
| `--timeout <ms>` | number | 600000 | Per-task timeout (ms) |
| `--stop-on-failure` | flag | false | Halt queue on first failure |
| `--permission-mode <mode>` | string | `acceptEdits` | Claude permission mode |
| `--log-level <level>` | string | `info` | Log verbosity |
| `--watch-interval <ms>` | number | 20000 | Poll interval in watch mode |
| `--dry-run` | flag | false | Parse tasks, don't execute |

Registers SIGINT/SIGTERM handlers to call `bot.abort()` for graceful shutdown.

#### `claudebot status`

Reads `.claudebot/sessions.json` and displays:
- Total accumulated cost (USD)
- Total task count
- Last 10 session records (line, status, cost, duration, prompt snippet)

---

### 4.2 Configuration — [src/config.ts](../src/config.ts)

**File search order:** `claudebot.config.json` → `claudebot.config.js` → `claudebot.config.ts` (from `process.cwd()`).

**Zod schema with defaults:**

```typescript
{
  engine: 'sdk' | 'cli'               // default: 'sdk'
  tasksFile: string                    // default: 'docs/todo.md'
  cwd: string                          // default: process.cwd()
  model?: string                       // default: undefined (SDK picks default)
  permissionMode: 'default'            // default: 'acceptEdits'
               | 'acceptEdits'
               | 'bypassPermissions'
  maxBudgetPerTaskUsd?: number         // default: undefined (no per-task limit)
  maxTotalBudgetUsd?: number           // default: undefined (no global limit)
  taskTimeoutMs: number                // default: 600_000 (10 min)
  maxRetries: number                   // default: 2
  stopOnFailure: boolean               // default: false
  sessionStorePath: string             // default: '.claudebot/sessions.json'
  logLevel: 'debug'|'info'|'warn'|'error' // default: 'info'
  watchIntervalMs: number              // default: 20_000 (20 sec)
  swarm?: SwarmConfig                  // optional swarm config
}
```

CLI flags are merged on top of file config (CLI flags take precedence).

---

### 4.3 Bot Orchestrator — [src/bot.ts](../src/bot.ts)

**Class:** `ClaudeBot`

**Constructor:** `new ClaudeBot(config: ClaudeBotConfig, logger: Logger)`

Internally creates:
- `IExecutor` via `createExecutor(config.engine)`
- `SessionManager` for persistent recording
- `CostTracker` for budget enforcement
- `AbortController` for graceful shutdown

#### Methods

| Method | Signature | Description |
|--------|-----------|-------------|
| `run()` | `(): Promise<BotRunResult>` | Main entry point. Runs all pending tasks. |
| `abort()` | `(): void` | Signals shutdown. Current task completes, queue stops. |
| `executeWithRetry()` | `(task): Promise<TaskResult>` | Wraps executor with exponential backoff. |
| `sleep()` | `(ms): Promise<void>` | Abort-aware sleep for watch mode polling. |

#### Task Execution Loop

```
parseTasks(tasksFile)
  → filter pending tasks
  → for each task:
      check budget → skip if over limit
      executeWithRetry(task)
        → executor.execute(task, config, logger)
        → on failure: exponential backoff, max maxRetries attempts
      updateTaskInFile(task, result)   // [x] or [!]
      sessionManager.record(result)
      costTracker.record(result.costUsd)
  → if no pending tasks && watch mode: sleep(watchIntervalMs), loop
```

#### Return Type: `BotRunResult`

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

### 4.4 Execution Engines

#### IExecutor Interface — [src/engine/types.ts](../src/engine/types.ts)

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

#### SDK Executor — [src/engine/sdk-executor.ts](../src/engine/sdk-executor.ts) ✅ Working

**Billing:** Anthropic API Key (per-token)
**Cost tracking:** Exact (`SDKResultMessage.total_cost_usd`)

**Execution flow:**

1. Create `AbortController` with `taskTimeoutMs` deadline
2. Build `AgentSDKOptions`:
   - `model` (from config or task tags)
   - `maxTurns` (from task tags or undefined)
   - `permissionMode` (from config)
   - `agents` (if swarm config present)
3. Call `query(prompt, options)` — returns async generator
4. Iterate messages from generator:
   - `type: 'system', subtype: 'init'` → capture `session_id`
   - `type: 'result'` → capture `total_cost_usd`, `duration_ms`, `is_error`
5. Return `TaskResult` with exact cost

**Verified working:** 2 tasks executed successfully ($0.1094 total) on 2026-02-27.

#### CLI Executor — [src/engine/cli-executor.ts](../src/engine/cli-executor.ts) ✅ Working

**Billing:** Claude Max subscription (flat rate)
**Cost tracking:** Unavailable (returns `-1`)

**Execution flow:**

1. Build CLI args: `-p <prompt> --output-format stream-json --verbose [--model] [--max-turns] [--permission-mode]`
2. `spawn('claude', args)` — close stdin immediately to prevent TTY hang
3. Parse newline-delimited JSON from stdout:
   - `type: 'system', subtype: 'init'` → capture `session_id`
   - `type: 'result'` → capture `is_error`, `cost_usd`
4. Handle process exit code
5. Apply `AbortController` timeout

**Verified working:** 8 tasks executed successfully (~$0.586 CLI subscription total) on 2026-02-27 to 2026-02-28.

#### Engine Factory — [src/engine/factory.ts](../src/engine/factory.ts)

```typescript
function createExecutor(engine: 'sdk' | 'cli'): IExecutor
```

Simple factory — returns `SdkExecutor` or `CliExecutor` based on config.

---

### 4.5 Task System

#### Parser — [src/task/parser.ts](../src/task/parser.ts)

**Regex:** `^(\s*[-*]\s*)\[([ xX!])\]\s+(.+)$`

**Checkbox states:**

| Marker | Status | Behavior |
|--------|--------|----------|
| `[ ]` | pending | Parsed and queued for execution |
| `[x]` or `[X]` | completed | Skipped |
| `[!]` | failed | Skipped |

**Inline tags** (stripped from prompt before execution):

| Tag | Field | Example |
|-----|-------|---------|
| `[cwd:path]` | `task.cwd` | `[cwd:src/utils]` |
| `[budget:n]` | `task.maxBudgetUsd` | `[budget:0.50]` |
| `[turns:n]` | `task.maxTurns` | `[turns:10]` |
| `[agent:name]` | `task.agent` | `[agent:developer]` |

**Task object:**

```typescript
interface Task {
  line: number;          // 1-indexed line in file (for write-back)
  rawText: string;       // Original line content
  prompt: string;        // Cleaned text (tags removed)
  status: TaskStatus;    // 'pending' | 'running' | 'completed' | 'failed' | 'skipped'
  cwd?: string;
  maxBudgetUsd?: number;
  maxTurns?: number;
  agent?: string;
  retryCount: number;
  tags: Record<string, string>;
}
```

#### Writer — [src/task/writer.ts](../src/task/writer.ts)

Updates the tasks file in-place after each execution:

- **Completed:** `[ ]` → `[x]`
- **Failed:** `[ ]` → `[!]` + appends `<!-- FAILED: retry N -->`
- **Line ending preservation:** Detects CRLF vs LF, maintains original format

---

### 4.6 Session Management — [src/session/manager.ts](../src/session/manager.ts)

**Storage path:** `.claudebot/sessions.json` (configurable via `sessionStorePath`)

**SessionStore format:**

```json
{
  "version": 1,
  "projectCwd": "/path/to/project",
  "totalCostUsd": 0.69503695,
  "records": [...]
}
```

**SessionRecord schema:**

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

Auto-loads on init, auto-saves after each `record()` call.

---

### 4.7 Cost Tracker — [src/cost/tracker.ts](../src/cost/tracker.ts)

In-memory tracker for the current run session.

```typescript
class CostTracker {
  record(costUsd: number): void;
  isOverBudget(): boolean;          // checks against config.maxTotalBudgetUsd
  remainingBudget(): number | null;
  getSummary(): CostSummary;
}

interface CostSummary {
  totalCostUsd: number;
  taskCount: number;
  averageCostPerTask: number;
  maxBudgetUsd: number | undefined;
}
```

Budget enforcement: `bot.ts` calls `isOverBudget()` before each task. If exceeded, remaining tasks are marked `skipped`.

---

### 4.8 Utilities

#### AbortController Wrapper — [src/utils/abort.ts](../src/utils/abort.ts)

```typescript
function createAbortController(timeoutMs?: number): {
  controller: AbortController;
  cleanup: () => void;   // clears the timeout timer
}
```

Sets a `setTimeout` to call `controller.abort()` at the deadline. `cleanup()` must be called after task completes to prevent memory leaks.

#### Retry Wrapper — [src/utils/retry.ts](../src/utils/retry.ts)

```typescript
function withRetry<T>(
  fn: () => Promise<T>,
  shouldRetry: (error: unknown, result?: T) => boolean,
  opts?: RetryOptions,
): Promise<T>

interface RetryOptions {
  maxRetries: number;
  baseDelayMs: number;   // default: 1000
  maxDelayMs: number;    // default: 30_000
  logger?: Logger;
}
```

**Backoff formula:** `delay = min(baseDelayMs × 2^attempt, maxDelayMs)`

---

### 4.9 Multi-Agent Swarm — [src/agent/swarm.ts](../src/agent/swarm.ts)

> **Status:** Framework defined. Not yet integrated into the main execution loop.

Uses the Agent SDK's native `agents` option — no external message broker (Redis, SQLite) required.

**Default pipeline: Manager → Developer + QA**

| Agent | Model | Tools | Role |
|-------|-------|-------|------|
| Manager | Opus | Read, Grep, Glob, Task | Decomposes tasks, delegates via `Task` tool, synthesizes results |
| Developer | Sonnet | Read, Grep, Glob, Edit, Write, Bash | Implements code changes |
| QA | Sonnet | Read, Grep, Glob, Bash | Reviews code, runs tests — **no write access** |

**Peer review loop:** Developer → QA validates → if failed, Manager routes feedback back to Developer (max 3 revision cycles).

**SwarmConfig type:**

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

## 5. Data Flow

```
User runs: claudebot run

  1. loadConfig()
     └─ Read claudebot.config.json
     └─ Merge CLI flags (override)
     └─ Validate with Zod schema

  2. parseTasks(config.tasksFile)
     └─ Read markdown file line-by-line
     └─ Match checkbox regex
     └─ Extract inline tags
     └─ Return Task[] (pending only)

  3. For each Task:
     │
     ├─ costTracker.isOverBudget() → true → mark skipped, continue
     │
     ├─ executor.execute(task, config, logger)
     │   ├─ [SDK] query(prompt, opts) → async generator
     │   │   ├─ message: init → session_id
     │   │   └─ message: result → cost, duration, is_error
     │   │
     │   └─ [CLI] spawn('claude', args) → stdout stream
     │       ├─ line: init JSON → session_id
     │       └─ line: result JSON → cost, is_error
     │
     ├─ writer.updateTaskInFile(task, result)
     │   ├─ success → [ ] → [x]
     │   └─ failure → [ ] → [!] + comment
     │
     ├─ sessionManager.record(result)
     │   └─ Append to sessions.json
     │
     └─ costTracker.record(result.costUsd)

  4. Return BotRunResult summary
```

---

## 6. Configuration Reference

Full `claudebot.config.json` field reference:

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `engine` | `"sdk" \| "cli"` | `"sdk"` | Execution engine selection |
| `tasksFile` | string | `"docs/todo.md"` | Path to markdown task file |
| `model` | string? | SDK default | Claude model ID |
| `permissionMode` | string | `"acceptEdits"` | Claude tool permission mode |
| `maxBudgetPerTaskUsd` | number? | — | Per-task USD limit |
| `maxTotalBudgetUsd` | number? | — | Total run USD limit |
| `taskTimeoutMs` | number | `600000` | Per-task timeout (10 min) |
| `maxRetries` | number | `2` | Max retry attempts |
| `stopOnFailure` | boolean | `false` | Halt queue on first failure |
| `sessionStorePath` | string | `".claudebot/sessions.json"` | Session history file |
| `logLevel` | string | `"info"` | Logging verbosity |
| `watchIntervalMs` | number | `20000` | Watch mode poll interval (20 sec) |
| `swarm` | object? | — | Multi-agent swarm config |

---

## 7. Implementation Status

| Feature | Status | Engine | Verified |
|---------|--------|--------|---------|
| Task queue parsing (checkboxes + tags) | ✅ Working | Both | 10 tasks |
| SDK execution via `query()` | ✅ Working | SDK | 2 tasks, $0.11 |
| CLI execution via `spawn('claude')` | ✅ Working | CLI | 8 tasks, $0.59 |
| Session persistence (sessions.json) | ✅ Working | Both | 10 records |
| Exact cost tracking | ✅ Working | SDK only | Yes |
| Budget enforcement (per-task + global) | ✅ Working | Both | — |
| Exponential backoff retry | ✅ Working | Both | — |
| Per-task timeout (AbortController) | ✅ Working | Both | — |
| Graceful SIGINT/SIGTERM shutdown | ✅ Working | Both | — |
| Dry-run mode (parse, no execute) | ✅ Working | Both | — |
| Watch mode (poll when queue empty) | ✅ Working | Both | — |
| Zod config validation | ✅ Working | Both | — |
| CLI `status` command | ✅ Working | Both | — |
| Task file write-back [x] / [!] | ✅ Working | Both | — |
| Inline tag parsing ([budget], [turns]) | ✅ Working | Both | — |
| Multi-agent swarm (definition) | 🔧 Defined | SDK only | Not integrated |
| Swarm execution integration | ❌ Not done | SDK only | — |
| Token count analytics | 🔧 Placeholder | SDK | — |
| Parallel task execution | ❌ Not planned | — | Sequential only |

---

## 8. Known Limitations

1. **Sequential execution only** — Tasks run one-at-a-time. No parallel execution.
2. **CLI executor: no cost tracking** — Returns `-1` for `costUsd`. Budget enforcement based on estimate.
3. **Swarm mode not integrated** — `src/agent/swarm.ts` defines the agent config but `ClaudeBot.run()` does not yet activate swarm routing.
4. **No resume across restarts** — Watch mode resets task state in memory on restart. Session history persists but in-progress tasks won't auto-resume.
5. **Single tasks file** — All tasks must be in one markdown file. No multi-file queue support.

---

## 9. File Structure

```
claude-bot/
├── src/
│   ├── index.ts              # CLI entry point (Commander)
│   ├── bot.ts                # ClaudeBot orchestrator
│   ├── config.ts             # Zod config loader
│   ├── types.ts              # Core type definitions
│   ├── logger/
│   │   └── index.ts          # Pino logger factory
│   ├── engine/
│   │   ├── types.ts          # IExecutor interface
│   │   ├── factory.ts        # Engine factory function
│   │   ├── sdk-executor.ts   # SDK engine (primary)
│   │   └── cli-executor.ts   # CLI engine (fallback)
│   ├── task/
│   │   ├── parser.ts         # Markdown task parser
│   │   └── writer.ts         # Task file updater
│   ├── session/
│   │   └── manager.ts        # Session persistence
│   ├── cost/
│   │   └── tracker.ts        # Budget/cost tracking
│   ├── agent/
│   │   └── swarm.ts          # Multi-agent swarm config
│   └── utils/
│       ├── abort.ts          # AbortController helper
│       └── retry.ts          # Exponential backoff retry
├── docs/
│   ├── PRD.md                # Product requirements
│   ├── TechSpec.md           # This document
│   └── todo.md               # Default task queue file
├── tasks.md                  # Example task queue
├── claudebot.config.json     # Project configuration
├── package.json
├── tsconfig.json
└── .claudebot/
    └── sessions.json         # Persistent session history
```
