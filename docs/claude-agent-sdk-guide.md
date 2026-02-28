# Claude Agent SDK — 실전 가이드

> `@anthropic-ai/claude-agent-sdk` v0.2.x 기준
> 다른 프로젝트에서 참조하는 독립 가이드입니다.

---

## 목차

1. [설치 & 환경 설정](#1-설치--환경-설정)
2. [핵심 개념: `query()`](#2-핵심-개념-query)
3. [메시지 타입 처리](#3-메시지-타입-처리)
4. [Options 레퍼런스](#4-options-레퍼런스)
5. [유즈케이스 모음](#5-유즈케이스-모음)
   - [5.1 기본 실행](#51-기본-실행)
   - [5.2 타임아웃 + Abort](#52-타임아웃--abort)
   - [5.3 비용 추적 & 예산 제한](#53-비용-추적--예산-제한)
   - [5.4 도구(Tool) 제한](#54-도구tool-제한)
   - [5.5 파일 수정 자동 승인](#55-파일-수정-자동-승인)
   - [5.6 시스템 프롬프트 주입](#56-시스템-프롬프트-주입)
   - [5.7 세션 재개 (Resume)](#57-세션-재개-resume)
   - [5.8 멀티 에이전트 Swarm](#58-멀티-에이전트-swarm)
   - [5.9 커스텀 권한 핸들러](#59-커스텀-권한-핸들러)
   - [5.10 구조화 출력 (JSON Schema)](#510-구조화-출력-json-schema)
   - [5.11 스트리밍 진행 상황 표시](#511-스트리밍-진행-상황-표시)
   - [5.12 태스크 큐 자동 실행기](#512-태스크-큐-자동-실행기)
6. [에러 처리 패턴](#6-에러-처리-패턴)
7. [실전 구현 레퍼런스 (ClaudeBot SdkExecutor)](#7-실전-구현-레퍼런스-claudebot-sdkexecutor)

---

## 1. 설치 & 환경 설정

```bash
npm install @anthropic-ai/claude-agent-sdk
```

**전제 조건:**
- Node.js 18+
- `ANTHROPIC_API_KEY` 환경변수 설정 (또는 Claude Max 로그인 상태)
- TypeScript 사용 시 `"module": "Node16"` 권장

```json
// tsconfig.json 최소 설정
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "Node16",
    "moduleResolution": "Node16",
    "strict": true
  }
}
```

```typescript
// ESM import (package.json에 "type": "module" 필요)
import { query } from '@anthropic-ai/claude-agent-sdk';
```

---

## 2. 핵심 개념: `query()`

`query()`는 Claude 에이전트를 실행하는 **유일한 진입점**입니다. 반환값은 `AsyncGenerator<SDKMessage>`이며, `for await`로 메시지를 스트리밍으로 받습니다.

```typescript
import { query } from '@anthropic-ai/claude-agent-sdk';
import type { Options } from '@anthropic-ai/claude-agent-sdk';

const q = query({
  prompt: '지금 디렉터리에 있는 TypeScript 파일 목록을 보여줘',
  options: {
    cwd: '/path/to/project',
    model: 'claude-sonnet-4-6',
    permissionMode: 'acceptEdits',
  } satisfies Options,
});

for await (const msg of q) {
  // msg 처리
}
```

**핵심 특성:**
- `query()`는 즉시 반환됩니다 (lazy). `for await` 루프가 실제 실행을 시작합니다.
- 루프가 끝나면 세션이 완료된 것입니다.
- `q.close()`로 중간에 중단할 수 있습니다.

---

## 3. 메시지 타입 처리

`for await`로 받는 각 메시지의 `type`/`subtype` 조합:

```typescript
for await (const msg of q) {
  switch (msg.type) {

    // ── 세션 초기화 ──────────────────────────────────────
    case 'system':
      if (msg.subtype === 'init') {
        // SDKSystemMessage: 세션 시작 시 최초 1회
        console.log('Session ID:', msg.session_id);
        console.log('Available tools:', msg.tools);
        console.log('Model:', msg.model);
        console.log('CWD:', msg.cwd);
      }
      if (msg.subtype === 'status') {
        // SDKStatusMessage: 상태 변경 (compacting 등)
        console.log('Status:', msg.status);
      }
      break;

    // ── 최종 결과 ────────────────────────────────────────
    case 'result':
      if (msg.subtype === 'success') {
        // SDKResultSuccess
        console.log('Result:', msg.result);
        console.log('Cost (USD):', msg.total_cost_usd);
        console.log('Duration (ms):', msg.duration_ms);
        console.log('Turns used:', msg.num_turns);
      } else {
        // SDKResultError: 'error_max_turns', 'error_max_budget_usd', etc.
        console.error('Failed:', msg.subtype);
        console.error('Errors:', msg.errors);
      }
      break;

    // ── 어시스턴트 메시지 ─────────────────────────────────
    case 'assistant':
      // SDKAssistantMessage: 완성된 어시스턴트 응답
      for (const block of msg.message.content) {
        if (block.type === 'text') {
          process.stdout.write(block.text);
        }
      }
      break;

    // ── 스트리밍 이벤트 ───────────────────────────────────
    case 'stream_event':
      // SDKPartialAssistantMessage: 토큰 단위 스트리밍
      // 실시간 출력이 필요할 때 사용
      break;

    // ── 도구 사용 요약 ────────────────────────────────────
    case 'tool_use_summary':
      // SDKToolUseSummaryMessage
      console.log('Tool used:', msg.tool_name);
      break;

    // ── 태스크 이벤트 (swarm) ─────────────────────────────
    case 'task_started':
      // SDKTaskStartedMessage: 서브에이전트 태스크 시작
      break;
    case 'task_progress':
      // SDKTaskProgressMessage
      break;
  }
}
```

**SDKResultMessage 주요 필드:**

| 필드 | 타입 | 설명 |
|------|------|------|
| `subtype` | `'success' \| 'error_*'` | 성공 여부 |
| `result` | `string` | 에이전트의 최종 텍스트 출력 |
| `total_cost_usd` | `number` | 정확한 API 비용 (USD) |
| `duration_ms` | `number` | 전체 실행 시간 |
| `duration_api_ms` | `number` | API 호출 순수 시간 |
| `num_turns` | `number` | 사용한 턴 수 |
| `session_id` | `string` | 세션 재개에 사용 |
| `usage` | `object` | 토큰 사용 상세 |
| `errors` | `string[]` | 발생한 에러 목록 |

---

## 4. Options 레퍼런스

`query()`에 전달하는 `Options` 타입의 전체 필드:

```typescript
type Options = {
  // ── 실행 환경 ───────────────────────────────────────────
  cwd?: string;                    // 작업 디렉터리 (기본: process.cwd())
  additionalDirectories?: string[]; // 추가 접근 허용 디렉터리

  // ── 모델 설정 ───────────────────────────────────────────
  model?: string;                  // 'claude-sonnet-4-6', 'claude-opus-4-6' 등

  // ── 대화 제어 ───────────────────────────────────────────
  maxTurns?: number;               // 최대 턴 수 (초과 시 error_max_turns)
  maxBudgetUsd?: number;           // 예산 한도 (초과 시 error_max_budget_usd)
  continue?: boolean;              // 최근 대화 이어서 하기 (resume과 함께 사용 불가)
  resume?: string;                 // 세션 ID로 재개

  // ── 권한 모드 ───────────────────────────────────────────
  permissionMode?: 'default'       // 위험 작업 시 사용자에게 묻기
                 | 'acceptEdits'   // 파일 수정 자동 승인
                 | 'bypassPermissions' // 모든 권한 체크 건너뜀 (주의!)
                 | 'plan'          // 계획만 세우기 (도구 실행 없음)
                 | 'dontAsk';      // 묻지 않고 거부
  allowDangerouslySkipPermissions?: boolean; // bypassPermissions 사용 시 필수

  // ── 도구 제어 ───────────────────────────────────────────
  allowedTools?: string[];         // 허용 도구 목록 (자동 승인)
  tools?: string[]                 // 사용 가능 도구 제한
        | { type: 'preset'; preset: 'claude_code' };
  disallowedTools?: string[];      // 명시적 차단 도구

  // ── 프롬프트 ────────────────────────────────────────────
  systemPrompt?: string            // 시스템 프롬프트 교체
              | { type: 'preset'; preset: 'claude_code'; append?: string };

  // ── 멀티 에이전트 ────────────────────────────────────────
  agent?: string;                  // 메인 에이전트 이름 (agents에 정의된 것)
  agents?: Record<string, AgentDefinition>; // 서브에이전트 정의

  // ── 취소 & 타임아웃 ──────────────────────────────────────
  abortController?: AbortController;

  // ── 커스텀 권한 ──────────────────────────────────────────
  canUseTool?: CanUseTool;         // 도구별 동적 권한 제어

  // ── 구조화 출력 ──────────────────────────────────────────
  outputFormat?: { type: 'json'; jsonSchema: Record<string, unknown> };
}
```

---

## 5. 유즈케이스 모음

### 5.1 기본 실행

가장 단순한 형태. 결과만 추출합니다.

```typescript
import { query } from '@anthropic-ai/claude-agent-sdk';

async function runSimple(prompt: string, cwd: string): Promise<string> {
  let result = '';

  for await (const msg of query({ prompt, options: { cwd } })) {
    if (msg.type === 'result' && msg.subtype === 'success') {
      result = msg.result;
    }
  }

  return result;
}

// 사용
const output = await runSimple('README.md 파일 읽고 요약해줘', '/my/project');
console.log(output);
```

---

### 5.2 타임아웃 + Abort

AbortController로 시간 제한을 걸고 정리합니다.

```typescript
import { query } from '@anthropic-ai/claude-agent-sdk';

async function runWithTimeout(prompt: string, timeoutMs: number) {
  const controller = new AbortController();
  const timer = setTimeout(() => {
    controller.abort(new Error(`Timeout after ${timeoutMs}ms`));
  }, timeoutMs);

  try {
    let costUsd = 0;
    let result = '';

    for await (const msg of query({
      prompt,
      options: {
        abortController: controller,
        cwd: process.cwd(),
      },
    })) {
      if (msg.type === 'result') {
        result = msg.subtype === 'success' ? msg.result : `Failed: ${msg.subtype}`;
        costUsd = msg.total_cost_usd;
      }
    }

    return { result, costUsd };
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      return { result: 'TIMEOUT', costUsd: 0 };
    }
    throw error;
  } finally {
    clearTimeout(timer); // 반드시 정리
  }
}

// 사용: 30초 제한
const { result, costUsd } = await runWithTimeout('큰 리팩터링 작업', 30_000);
console.log(`비용: $${costUsd.toFixed(4)}, 결과: ${result}`);
```

---

### 5.3 비용 추적 & 예산 제한

태스크별 예산을 설정하고 전체 누적 비용을 추적합니다.

```typescript
import { query } from '@anthropic-ai/claude-agent-sdk';

interface RunResult {
  success: boolean;
  result: string;
  costUsd: number;
  durationMs: number;
  sessionId: string;
}

// 태스크별 예산 제한 + 정확한 비용 반환
async function runWithBudget(
  prompt: string,
  maxBudgetUsd: number,
): Promise<RunResult> {
  let costUsd = 0;
  let result = '';
  let sessionId = '';
  let success = false;
  let durationMs = 0;

  for await (const msg of query({
    prompt,
    options: {
      maxBudgetUsd,     // 이 금액 초과 시 자동 중단
      model: 'claude-sonnet-4-6',
      permissionMode: 'acceptEdits',
    },
  })) {
    if (msg.type === 'system' && msg.subtype === 'init') {
      sessionId = msg.session_id;
    }
    if (msg.type === 'result') {
      costUsd = msg.total_cost_usd;
      durationMs = msg.duration_ms;
      sessionId = msg.session_id;
      if (msg.subtype === 'success') {
        success = true;
        result = msg.result;
      } else if (msg.subtype === 'error_max_budget_usd') {
        // 예산 초과로 중단됨
        result = '예산 초과로 중단되었습니다.';
      }
    }
  }

  return { success, result, costUsd, durationMs, sessionId };
}

// 전체 큐 비용 추적
async function runTaskQueue(tasks: string[], totalBudgetUsd: number) {
  let totalCost = 0;

  for (const task of tasks) {
    if (totalCost >= totalBudgetUsd) {
      console.log(`예산 소진 ($${totalCost.toFixed(4)}). 남은 태스크 건너뜀.`);
      break;
    }

    const remaining = totalBudgetUsd - totalCost;
    const res = await runWithBudget(task, Math.min(2.0, remaining));

    totalCost += res.costUsd;
    console.log(`✅ 완료 | 비용: $${res.costUsd.toFixed(4)} | 누적: $${totalCost.toFixed(4)}`);
  }
}
```

---

### 5.4 도구(Tool) 제한

에이전트가 사용할 수 있는 도구를 제한합니다.

```typescript
import { query } from '@anthropic-ai/claude-agent-sdk';

// 읽기 전용 에이전트 (파일 읽기/검색만 허용)
async function runReadOnly(prompt: string) {
  for await (const msg of query({
    prompt,
    options: {
      tools: ['Read', 'Grep', 'Glob'],   // 이 도구만 사용 가능
      permissionMode: 'acceptEdits',
    },
  })) {
    if (msg.type === 'result' && msg.subtype === 'success') {
      console.log(msg.result);
    }
  }
}

// Bash만 금지
async function runNoBash(prompt: string) {
  for await (const msg of query({
    prompt,
    options: {
      disallowedTools: ['Bash'],         // Bash만 차단, 나머지는 허용
    },
  })) {
    if (msg.type === 'result' && msg.subtype === 'success') {
      console.log(msg.result);
    }
  }
}

// 코드 리뷰 에이전트 (파일 수정 없이 리뷰만)
async function codeReview(filePath: string) {
  const prompt = `${filePath} 파일을 코드 리뷰해줘. 버그, 보안 이슈, 개선점을 지적해줘.`;

  for await (const msg of query({
    prompt,
    options: {
      tools: ['Read', 'Grep', 'Glob'],   // 절대 파일 수정 불가
      systemPrompt: 'You are a code reviewer. Analyze code and provide feedback. Do NOT modify any files.',
    },
  })) {
    if (msg.type === 'result' && msg.subtype === 'success') {
      return msg.result;
    }
  }
}
```

**사용 가능한 도구 이름:**
`Read`, `Write`, `Edit`, `MultiEdit`, `Bash`, `Glob`, `Grep`, `Task`, `WebFetch`, `WebSearch`, `TodoWrite`, `NotebookEdit`, `NotebookRead`

---

### 5.5 파일 수정 자동 승인

CI/CD나 배치 환경에서 사용자 확인 없이 실행합니다.

```typescript
import { query } from '@anthropic-ai/claude-agent-sdk';

// 파일 수정은 자동 승인, Bash 실행은 여전히 확인
async function autoEditMode(prompt: string) {
  for await (const msg of query({
    prompt,
    options: {
      permissionMode: 'acceptEdits',     // Write/Edit 자동 승인
      cwd: '/my/project',
    },
  })) {
    if (msg.type === 'result') {
      console.log(msg.subtype === 'success' ? '✅' : '❌', msg.result);
    }
  }
}

// 모든 권한 완전 우회 (자동화 파이프라인용, 주의해서 사용)
async function fullyAutomated(prompt: string) {
  for await (const msg of query({
    prompt,
    options: {
      permissionMode: 'bypassPermissions',
      allowDangerouslySkipPermissions: true,  // 명시적으로 위험 인지
      cwd: '/sandbox',                          // 가능하면 샌드박스 경로 사용
    },
  })) {
    if (msg.type === 'result' && msg.subtype === 'success') {
      return msg.result;
    }
  }
}
```

---

### 5.6 시스템 프롬프트 주입

에이전트의 역할과 행동 방식을 정의합니다.

```typescript
import { query } from '@anthropic-ai/claude-agent-sdk';

// 커스텀 시스템 프롬프트로 역할 지정
async function runAsExpert(prompt: string, expertise: string) {
  const systemPrompt = `
You are a ${expertise} expert with 10+ years of experience.
- Always explain your reasoning before taking action
- Prefer conservative, safe approaches
- If uncertain, ask for clarification before modifying files
- Write clean, well-commented code
`;

  for await (const msg of query({
    prompt,
    options: {
      systemPrompt,                // 기본 프롬프트 완전 교체
      permissionMode: 'acceptEdits',
    },
  })) {
    if (msg.type === 'result' && msg.subtype === 'success') {
      return msg.result;
    }
  }
}

// 기본 Claude Code 프롬프트에 내용 추가 (교체하지 않고)
async function runWithAppendedPrompt(prompt: string) {
  for await (const msg of query({
    prompt,
    options: {
      systemPrompt: {
        type: 'preset',
        preset: 'claude_code',
        append: '항상 한국어로 대답하세요. 파일을 수정하기 전에 반드시 읽어보세요.',
      },
    },
  })) {
    if (msg.type === 'result' && msg.subtype === 'success') {
      return msg.result;
    }
  }
}
```

---

### 5.7 세션 재개 (Resume)

이전 대화를 이어서 추가 작업을 수행합니다.

```typescript
import { query } from '@anthropic-ai/claude-agent-sdk';

// 세션 ID 저장 후 재개하는 패턴
async function runResumable(prompt: string, previousSessionId?: string) {
  let sessionId = '';
  let result = '';

  const options = previousSessionId
    ? { resume: previousSessionId }      // 이전 세션 이어서
    : { permissionMode: 'acceptEdits' as const };

  for await (const msg of query({ prompt, options })) {
    if (msg.type === 'system' && msg.subtype === 'init') {
      sessionId = msg.session_id;
    }
    if (msg.type === 'result' && msg.subtype === 'success') {
      result = msg.result;
    }
  }

  return { sessionId, result };
}

// 실제 사용: 연속 작업
const step1 = await runResumable('프로젝트 구조 파악하고 개선 계획 세워줘');
console.log('계획 수립 완료. Session:', step1.sessionId);

// 같은 세션에서 실행 단계 진행
const step2 = await runResumable('이제 계획대로 구현 시작해줘', step1.sessionId);
console.log('구현 완료:', step2.result);
```

---

### 5.8 멀티 에이전트 Swarm

SDK 네이티브 `agents` 옵션으로 외부 인프라 없이 멀티 에이전트를 구성합니다.

```typescript
import { query } from '@anthropic-ai/claude-agent-sdk';
import type { AgentDefinition } from '@anthropic-ai/claude-agent-sdk';

// Manager → Developer + QA 파이프라인
const agents: Record<string, AgentDefinition> = {
  manager: {
    description: '태스크를 분해하고 developer/qa 에이전트에게 위임하는 매니저',
    prompt: `You are a project manager.
1. Analyze the task and break it into subtasks
2. Delegate coding to "developer" using the Task tool
3. Delegate review to "qa" using the Task tool
4. If QA finds issues, send feedback to developer (max 3 cycles)
5. Summarize the final result`,
    tools: ['Read', 'Grep', 'Glob', 'Task'],
    model: 'opus',
  },
  developer: {
    description: '코드를 구현하는 시니어 개발자',
    prompt: `You are a senior developer.
1. Read relevant files first
2. Implement the requested changes
3. Follow existing code patterns
4. Handle errors and edge cases`,
    tools: ['Read', 'Grep', 'Glob', 'Edit', 'Write', 'Bash'],
    model: 'sonnet',
  },
  qa: {
    description: '코드를 리뷰하고 테스트하는 QA 엔지니어 (수정 권한 없음)',
    prompt: `You are a QA engineer.
1. Review code changes for bugs and security issues
2. Run tests if available
3. Provide clear, actionable feedback
4. Approve if everything is correct`,
    tools: ['Read', 'Grep', 'Glob', 'Bash'],  // Write/Edit 제외 (읽기 전용)
    model: 'sonnet',
  },
};

async function runSwarm(task: string, cwd: string) {
  let result = '';

  for await (const msg of query({
    prompt: task,
    options: {
      agents,
      agent: 'manager',            // 진입점 에이전트
      allowedTools: ['Task'],      // 메인 스레드에 Task 도구 허용
      permissionMode: 'acceptEdits',
      cwd,
    },
  })) {
    if (msg.type === 'task_started') {
      console.log(`[SWARM] 서브에이전트 시작: ${msg.agent_id}`);
    }
    if (msg.type === 'result' && msg.subtype === 'success') {
      result = msg.result;
    }
  }

  return result;
}

// 간단한 2-에이전트 구성 (리서처 + 구현자)
const simpleSwarm: Record<string, AgentDefinition> = {
  researcher: {
    description: '코드베이스를 분석하는 리서처',
    prompt: 'Analyze the codebase and provide insights. Use Task tool to delegate implementation.',
    tools: ['Read', 'Grep', 'Glob', 'Task'],
    model: 'sonnet',
  },
  implementer: {
    description: '실제 코드를 작성하는 구현자',
    prompt: 'Implement the requested changes based on the researcher\'s findings.',
    tools: ['Read', 'Edit', 'Write', 'Bash'],
    model: 'sonnet',
  },
};
```

**Swarm 주의사항:**
- `agents` 옵션은 SDK 엔진에서만 동작합니다
- 메인 에이전트에 `'Task'` 도구가 없으면 서브에이전트를 호출할 수 없습니다
- QA처럼 읽기 전용 에이전트는 `Write`, `Edit` 도구를 제외합니다
- 서브에이전트 비용도 `total_cost_usd`에 포함됩니다

---

### 5.9 커스텀 권한 핸들러

도구 실행 전 동적으로 허용/거부 여부를 결정합니다.

```typescript
import { query } from '@anthropic-ai/claude-agent-sdk';
import type { CanUseTool, PermissionResult } from '@anthropic-ai/claude-agent-sdk';

// 위험한 디렉터리 보호
const safePermissionHandler: CanUseTool = async (toolName, input, context) => {
  // Bash 명령 중 rm -rf 차단
  if (toolName === 'Bash') {
    const command = input.command as string ?? '';
    if (command.includes('rm -rf') || command.includes('sudo')) {
      return { behavior: 'deny', message: '위험한 명령은 허용되지 않습니다.' };
    }
  }

  // /production 경로 수정 차단
  if (toolName === 'Write' || toolName === 'Edit') {
    const path = (input.file_path ?? input.path) as string ?? '';
    if (path.includes('/production/') || path.includes('/prod/')) {
      return { behavior: 'deny', message: '프로덕션 파일은 직접 수정할 수 없습니다.' };
    }
  }

  // 그 외는 모두 허용
  return { behavior: 'allow' };
};

// 특정 도구만 사용자에게 묻기
const selectivePermission: CanUseTool = async (toolName, input) => {
  const safeTools = new Set(['Read', 'Grep', 'Glob']);

  if (safeTools.has(toolName)) {
    return { behavior: 'allow' };   // 읽기 도구는 자동 허용
  }

  // 수정 도구는 사용자에게 확인 (터미널에서 실행 시)
  return { behavior: 'ask' };
};

async function runWithCustomPermission(prompt: string) {
  for await (const msg of query({
    prompt,
    options: {
      canUseTool: safePermissionHandler,
      // canUseTool 사용 시 permissionMode는 'default'로 설정
    },
  })) {
    if (msg.type === 'result') {
      console.log(msg.subtype, msg.result ?? msg.errors);
    }
  }
}
```

---

### 5.10 구조화 출력 (JSON Schema)

에이전트가 정해진 JSON 스키마로 응답하게 합니다.

```typescript
import { query } from '@anthropic-ai/claude-agent-sdk';

// 파일 분석 결과를 구조화된 JSON으로 받기
interface CodeAnalysis {
  language: string;
  complexity: 'low' | 'medium' | 'high';
  issues: Array<{ line: number; message: string; severity: 'error' | 'warning' }>;
  suggestions: string[];
}

async function analyzeCode(filePath: string): Promise<CodeAnalysis> {
  const jsonSchema = {
    type: 'object',
    properties: {
      language: { type: 'string' },
      complexity: { type: 'string', enum: ['low', 'medium', 'high'] },
      issues: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            line: { type: 'number' },
            message: { type: 'string' },
            severity: { type: 'string', enum: ['error', 'warning'] },
          },
          required: ['line', 'message', 'severity'],
        },
      },
      suggestions: { type: 'array', items: { type: 'string' } },
    },
    required: ['language', 'complexity', 'issues', 'suggestions'],
  };

  let rawResult = '';

  for await (const msg of query({
    prompt: `${filePath} 파일을 분석해서 지정된 JSON 스키마로 결과를 반환해줘`,
    options: {
      tools: ['Read'],
      outputFormat: { type: 'json', jsonSchema },
    },
  })) {
    if (msg.type === 'result' && msg.subtype === 'success') {
      rawResult = msg.result;
    }
  }

  return JSON.parse(rawResult) as CodeAnalysis;
}
```

---

### 5.11 스트리밍 진행 상황 표시

토큰 단위로 실시간 출력을 표시합니다.

```typescript
import { query } from '@anthropic-ai/claude-agent-sdk';

async function runWithStreaming(prompt: string) {
  process.stdout.write('Claude: ');

  for await (const msg of query({ prompt, options: { cwd: process.cwd() } })) {
    switch (msg.type) {
      case 'assistant':
        // 완성된 메시지 블록
        for (const block of msg.message.content) {
          if (block.type === 'text') {
            process.stdout.write(block.text);
          }
        }
        break;

      case 'stream_event':
        // 토큰 단위 스트리밍 (더 빠른 체감)
        if (msg.event.type === 'content_block_delta') {
          const delta = msg.event.delta;
          if ('text' in delta) {
            process.stdout.write(delta.text);
          }
        }
        break;

      case 'tool_use_summary':
        process.stdout.write(`\n[🔧 ${msg.tool_name} 사용 중...]\n`);
        break;

      case 'result':
        process.stdout.write('\n');
        if (msg.subtype === 'success') {
          console.log(`\n✅ 완료 | $${msg.total_cost_usd.toFixed(4)} | ${msg.duration_ms}ms`);
        } else {
          console.error(`\n❌ 실패: ${msg.subtype}`);
        }
        break;
    }
  }
}
```

---

### 5.12 태스크 큐 자동 실행기

여러 태스크를 순서대로 자동 실행하는 패턴입니다.

```typescript
import { query } from '@anthropic-ai/claude-agent-sdk';

interface Task {
  id: string;
  prompt: string;
  maxBudgetUsd?: number;
  maxTurns?: number;
  cwd?: string;
}

interface TaskResult {
  id: string;
  success: boolean;
  result: string;
  costUsd: number;
  durationMs: number;
  sessionId: string;
  retryCount: number;
}

async function executeTask(task: Task, retryCount = 0): Promise<TaskResult> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10 * 60 * 1000); // 10분

  try {
    let sessionId = '';
    let costUsd = 0;
    let result = '';
    let success = false;
    let durationMs = 0;

    for await (const msg of query({
      prompt: task.prompt,
      options: {
        cwd: task.cwd ?? process.cwd(),
        maxTurns: task.maxTurns,
        maxBudgetUsd: task.maxBudgetUsd,
        permissionMode: 'acceptEdits',
        model: 'claude-sonnet-4-6',
        abortController: controller,
      },
    })) {
      if (msg.type === 'system' && msg.subtype === 'init') {
        sessionId = msg.session_id;
      }
      if (msg.type === 'result') {
        costUsd = msg.total_cost_usd;
        durationMs = msg.duration_ms;
        sessionId = msg.session_id;
        success = msg.subtype === 'success';
        result = success ? msg.result : `${msg.subtype}: ${msg.errors?.join(', ')}`;
      }
    }

    return { id: task.id, success, result, costUsd, durationMs, sessionId, retryCount };
  } catch (err) {
    if (err instanceof Error && err.name === 'AbortError') {
      return { id: task.id, success: false, result: 'TIMEOUT', costUsd: 0, durationMs: 0, sessionId: '', retryCount };
    }
    throw err;
  } finally {
    clearTimeout(timeout);
  }
}

async function runQueue(
  tasks: Task[],
  options: { maxRetries: number; totalBudgetUsd: number; stopOnFailure: boolean },
) {
  const results: TaskResult[] = [];
  let totalCost = 0;

  for (const task of tasks) {
    // 예산 초과 체크
    if (totalCost >= options.totalBudgetUsd) {
      console.log(`[SKIP] 예산 소진. 태스크 ${task.id} 건너뜀`);
      continue;
    }

    let lastResult: TaskResult | null = null;
    let attempt = 0;

    // 재시도 루프
    while (attempt <= options.maxRetries) {
      console.log(`[RUN] 태스크 ${task.id} (시도 ${attempt + 1}/${options.maxRetries + 1})`);

      lastResult = await executeTask(task, attempt);

      if (lastResult.success) break;

      attempt++;
      if (attempt <= options.maxRetries) {
        const delay = 1000 * 2 ** (attempt - 1); // 지수 백오프
        console.log(`[RETRY] ${delay}ms 후 재시도...`);
        await new Promise(res => setTimeout(res, delay));
      }
    }

    if (lastResult) {
      results.push(lastResult);
      totalCost += lastResult.costUsd;

      const status = lastResult.success ? '✅' : '❌';
      console.log(`${status} 태스크 ${task.id} | $${lastResult.costUsd.toFixed(4)} | ${lastResult.durationMs}ms`);

      if (!lastResult.success && options.stopOnFailure) {
        console.log('[STOP] 실패로 인해 큐 중단');
        break;
      }
    }
  }

  console.log(`\n총 비용: $${totalCost.toFixed(4)} | 완료: ${results.filter(r => r.success).length}/${results.length}`);
  return results;
}

// 사용 예시
const tasks: Task[] = [
  { id: 'task-1', prompt: 'package.json 의존성 버전 업데이트해줘', maxBudgetUsd: 1.0 },
  { id: 'task-2', prompt: '타입스크립트 에러 수정해줘', maxBudgetUsd: 2.0, maxTurns: 20 },
  { id: 'task-3', prompt: '테스트 커버리지 80% 이상 달성해줘', maxBudgetUsd: 3.0 },
];

const results = await runQueue(tasks, {
  maxRetries: 2,
  totalBudgetUsd: 10.0,
  stopOnFailure: false,
});
```

---

## 6. 에러 처리 패턴

### 결과 subtype별 처리

```typescript
for await (const msg of query({ prompt, options })) {
  if (msg.type !== 'result') continue;

  switch (msg.subtype) {
    case 'success':
      // 정상 완료
      console.log('결과:', msg.result);
      break;

    case 'error_max_turns':
      // maxTurns 초과 - 더 높은 값으로 재시도
      console.error(`턴 한도 초과 (${msg.num_turns}턴 사용됨)`);
      break;

    case 'error_max_budget_usd':
      // 예산 초과 - 더 많은 예산으로 재시도하거나 포기
      console.error(`예산 초과 ($${msg.total_cost_usd})`);
      break;

    case 'error_during_execution':
      // 실행 중 에러
      console.error('실행 에러:', msg.errors);
      break;

    default:
      console.error('알 수 없는 실패:', msg.subtype);
  }
}
```

### try/catch 구조

```typescript
async function safeRun(prompt: string) {
  try {
    for await (const msg of query({ prompt })) {
      // 처리
    }
  } catch (error) {
    if (error instanceof Error) {
      if (error.name === 'AbortError') {
        // AbortController에 의한 취소
        console.warn('취소됨:', error.message);
      } else if (error.message.includes('API key')) {
        // 인증 오류
        console.error('API 키 오류. ANTHROPIC_API_KEY 환경변수를 확인하세요.');
      } else {
        // 기타 네트워크/런타임 오류
        console.error('예상치 못한 오류:', error.message);
        throw error; // 재던지기
      }
    }
  }
}
```

---

## 7. 실전 구현 레퍼런스 (ClaudeBot SdkExecutor)

이 가이드의 패턴들은 [ClaudeBot 프로젝트](https://github.com/your-repo/claude-bot)의 실제 구현에서 검증되었습니다.

**실제 검증 기록:**
- SDK 엔진: 2개 태스크, $0.1094, 100% 성공률
- CLI 엔진: 8개 태스크, $0.586, 100% 성공률
- 총 10개 태스크, $0.695 처리 완료

**ClaudeBot SdkExecutor의 핵심 구현 패턴 ([src/engine/sdk-executor.ts](../src/engine/sdk-executor.ts)):**

```typescript
// 실제 동작하는 최소 구현 (ClaudeBot에서 검증됨)
import { query } from '@anthropic-ai/claude-agent-sdk';

export async function executeWithSdk(prompt: string, options: {
  cwd: string;
  model?: string;
  maxTurns?: number;
  maxBudgetUsd?: number;
  permissionMode?: 'default' | 'acceptEdits' | 'bypassPermissions';
  systemPromptPrefix?: string;
  timeoutMs?: number;
}): Promise<{
  success: boolean;
  result: string;
  costUsd: number;
  durationMs: number;
  sessionId: string;
  errors: string[];
}> {
  const controller = new AbortController();
  const timer = options.timeoutMs
    ? setTimeout(() => controller.abort(), options.timeoutMs)
    : null;

  let sessionId = '';
  let costUsd = 0;
  let durationMs = 0;
  let resultText = '';
  const errors: string[] = [];

  const fullPrompt = options.systemPromptPrefix
    ? `${options.systemPromptPrefix}\n\n${prompt}`
    : prompt;

  try {
    for await (const msg of query({
      prompt: fullPrompt,
      options: {
        cwd: options.cwd,
        abortController: controller,
        permissionMode: options.permissionMode ?? 'acceptEdits',
        ...(options.model && { model: options.model }),
        ...(options.maxTurns && { maxTurns: options.maxTurns }),
        ...(options.maxBudgetUsd && { maxBudgetUsd: options.maxBudgetUsd }),
        ...(options.permissionMode === 'bypassPermissions' && {
          allowDangerouslySkipPermissions: true,
        }),
      },
    })) {
      if (msg.type === 'system' && msg.subtype === 'init') {
        sessionId = msg.session_id;
      }
      if (msg.type === 'result') {
        costUsd = msg.total_cost_usd;
        durationMs = msg.duration_ms;
        sessionId = msg.session_id;
        if (msg.subtype === 'success') {
          resultText = msg.result;
        } else {
          resultText = `Task failed: ${msg.subtype}`;
          if (msg.errors) errors.push(...msg.errors);
        }
      }
    }
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      return { success: false, result: 'TIMEOUT', costUsd, durationMs: 0, sessionId, errors: ['Timeout'] };
    }
    throw error;
  } finally {
    if (timer) clearTimeout(timer);
  }

  const success = errors.length === 0 && resultText !== '' && !resultText.startsWith('Task failed');
  return { success, result: resultText, costUsd, durationMs, sessionId, errors };
}
```

---

## 빠른 참조 카드

| 목적 | 핵심 옵션 |
|------|-----------|
| 기본 실행 | `cwd`, `model` |
| 타임아웃 | `abortController` |
| 비용 제한 | `maxBudgetUsd` |
| 턴 제한 | `maxTurns` |
| 파일 수정 자동 승인 | `permissionMode: 'acceptEdits'` |
| 완전 자동화 | `permissionMode: 'bypassPermissions'` + `allowDangerouslySkipPermissions: true` |
| 도구 제한 | `tools: ['Read', 'Grep']` |
| 도구 차단 | `disallowedTools: ['Bash']` |
| 시스템 프롬프트 | `systemPrompt` |
| 세션 재개 | `resume: sessionId` |
| 멀티 에이전트 | `agents: {...}` + `agent: 'mainAgent'` |
| 구조화 출력 | `outputFormat: { type: 'json', jsonSchema }` |
| 동적 권한 | `canUseTool: fn` |

| 메시지 타입 | 언제 |
|------------|------|
| `system/init` | 세션 시작 시 (session_id 추출) |
| `system/status` | 상태 변경 시 (compacting 등) |
| `result/success` | 정상 완료 (result, costUsd 추출) |
| `result/error_*` | 실패 (errors 추출) |
| `assistant` | 어시스턴트 응답 블록 |
| `stream_event` | 토큰 단위 스트리밍 |
| `tool_use_summary` | 도구 사용 완료 |
| `task_started` | Swarm 서브에이전트 시작 |
