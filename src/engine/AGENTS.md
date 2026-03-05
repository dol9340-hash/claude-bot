# Engine AGENTS.md

IExecutor 추상화 + SDK 전용 구현.

## 핵심 규칙

- `IExecutor`가 유일한 추상화. `SdkExecutor`가 유일한 구현체.
- CLI executor를 추가하지 않는다. `EngineType = 'sdk'` 고정.
- `factory.ts`는 반드시 `SdkExecutor`만 반환한다.

## IExecutor Interface

```ts
interface IExecutor {
  execute(options: ExecuteOptions): Promise<TaskResult>;
}
interface ExecuteOptions {
  prompt: string;
  config: ClaudeBotConfig;
  cwd?: string;
  callbacks?: ExecutorCallbacks;
}
```

## SDK Options Mapping

`ClaudeBotConfig` → `query()` 옵션 매핑:
- `maxTurnsPerTask` → `maxTurns`
- `maxBudgetPerTaskUsd` → `maxBudgetUsd`
- `model` → `model`
- `permissionMode` → `permissionMode`
- `permissionMode === 'bypassPermissions'` → `allowDangerouslySkipPermissions: true` 추가 필요
- `allowedTools` → `allowedTools`
- `systemPromptPrefix` → prompt 앞에 prepend

## Abort & Timeout

- 항상 `createAbortController(config.taskTimeoutMs)` 사용.
- `finally` 블록에서 반드시 `cleanup()` 호출.
- AbortError는 `{ success: false, result: 'Task timed out' }`으로 처리.

## Callbacks

- `onCost(costUsd, sessionId)` — 비용 발생 시 호출.
- `onProgress(message)` — 스트리밍 진행 상황 (미구현 예약).
