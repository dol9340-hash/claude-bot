# Config 옵션 문서

ClaudeBot 설정 파일 `claudebot.config.json`은 대상 프로젝트 루트에 위치합니다.
모든 필드는 **선택적**이며, 생략 시 기본값이 적용됩니다.

---

## 전체 스키마

```json
{
  "model": "claude-sonnet-4-6",
  "cwd": ".",
  "permissionMode": "acceptEdits",
  "maxBudgetPerTaskUsd": 1.0,
  "maxTurnsPerTask": 20,
  "maxTotalBudgetUsd": 10.0,
  "taskTimeoutMs": 600000,
  "logLevel": "info",
  "allowedTools": ["Read", "Write", "Edit", "Bash", "Grep", "Glob"],
  "systemPromptPrefix": "",
  "autoOnboarding": false,
  "retryOnMaxTurns": true,
  "maxTurnsRetryIncrement": 8,
  "maxTurnsRetryLimit": 48,
  "developmentHeartbeatIntervalMs": 45000
}
```

---

## 옵션 상세

### `model`

| 항목 | 값 |
|------|------|
| 타입 | `string` |
| 기본값 | (SDK 기본 모델) |
| 설명 | 사용할 Claude 모델 ID |

예시: `"claude-sonnet-4-6"`, `"claude-opus-4-6"`, `"claude-haiku-4-5-20251001"`

### `cwd`

| 항목 | 값 |
|------|------|
| 타입 | `string` |
| 기본값 | `process.cwd()` |
| 설명 | 봇이 코드를 실행할 기본 작업 디렉토리 |

일반적으로 프로젝트 루트로 자동 설정되므로 별도 지정 불필요.

### `permissionMode`

| 항목 | 값 |
|------|------|
| 타입 | `"default" \| "acceptEdits" \| "bypassPermissions"` |
| 기본값 | `"acceptEdits"` |
| 설명 | Agent SDK 권한 모드 |

| 값 | 동작 |
|----|------|
| `default` | 모든 파일 수정에 사용자 확인 필요 |
| `acceptEdits` | 파일 편집 자동 허용 (권장) |
| `bypassPermissions` | 모든 권한 자동 허용 (주의) |

### `maxBudgetPerTaskUsd`

| 항목 | 값 |
|------|------|
| 타입 | `number` (양수) |
| 기본값 | 제한 없음 |
| 설명 | 봇 1개 태스크당 최대 비용 (USD) |

한 태스크가 이 금액을 초과하면 해당 태스크가 중단됩니다.

### `maxTurnsPerTask`

| 항목 | 값 |
|------|------|
| 타입 | `number` (양의 정수) |
| 기본값 | 제한 없음 |
| 설명 | 봇 1개 태스크당 최대 턴 수 |

Agent SDK의 `maxTurns` 파라미터에 매핑됩니다.

### `maxTotalBudgetUsd`

| 항목 | 값 |
|------|------|
| 타입 | `number` (양수) |
| 기본값 | 제한 없음 |
| 설명 | 전체 프로젝트 누적 예산 한도 (USD) |

이 금액에 도달하면:
- 진행 중인 개발이 자동 중단됩니다
- Auto-Pilot 모드가 자동 해제됩니다
- 사용자에게 예산 초과 알림이 표시됩니다

### `taskTimeoutMs`

| 항목 | 값 |
|------|------|
| 타입 | `number` (양의 정수) |
| 기본값 | `600000` (10분) |
| 설명 | 봇 1개 태스크의 타임아웃 (밀리초) |

### `logLevel`

| 항목 | 값 |
|------|------|
| 타입 | `"debug" \| "info" \| "warn" \| "error"` |
| 기본값 | `"info"` |
| 설명 | 서버 로그 출력 수준 |

### `allowedTools`

| 항목 | 값 |
|------|------|
| 타입 | `string[]` |
| 기본값 | (전체 허용) |
| 설명 | 봇이 사용할 수 있는 도구 목록 |

사용 가능한 도구: `Read`, `Write`, `Edit`, `Bash`, `Grep`, `Glob`, `WebFetch`, `WebSearch`

### `systemPromptPrefix`

| 항목 | 값 |
|------|------|
| 타입 | `string` |
| 기본값 | `""` |
| 설명 | 봇 시스템 프롬프트 앞에 추가할 텍스트 |

프로젝트 규칙이나 코딩 컨벤션을 봇에게 전달할 때 사용합니다.

### `autoOnboarding`

| 항목 | 값 |
|------|------|
| 타입 | `boolean` |
| 기본값 | `false` |
| 설명 | Auto-Pilot 모드 활성화 |

`true`로 설정하면 Epic 완료 후 자동으로 다음 Epic을 시작합니다.
중단 조건:
- `maxTotalBudgetUsd` 초과 시 자동 중단
- 사용자 채팅으로 "중단" 또는 "stop" 입력 시 즉시 중단
- Dashboard의 Auto-Pilot 토글로 해제

### `retryOnMaxTurns`

| 항목 | 값 |
|------|------|
| 타입 | `boolean` |
| 기본값 | `true` |
| 설명 | `error_max_turns` 발생 시 축약 프롬프트로 1회 자동 재시도 |

### `maxTurnsRetryIncrement`

| 항목 | 값 |
|------|------|
| 타입 | `number` (양의 정수) |
| 기본값 | `8` |
| 설명 | 재시도 시 기존 `maxTurnsPerTask`에 더할 턴 수 |

### `maxTurnsRetryLimit`

| 항목 | 값 |
|------|------|
| 타입 | `number` (양의 정수) |
| 기본값 | `48` |
| 설명 | 재시도에서 허용되는 최대 턴 상한 |

### `developmentHeartbeatIntervalMs`

| 항목 | 값 |
|------|------|
| 타입 | `number` (양의 정수) |
| 기본값 | `45000` |
| 설명 | 개발 단계에서 메인 채널 진행 상태 메시지 주기 (밀리초) |

---

## 예시

### 최소 설정

```json
{}
```

모든 기본값으로 실행됩니다.

### 예산 제한 설정

```json
{
  "maxTotalBudgetUsd": 5.0,
  "maxBudgetPerTaskUsd": 0.5
}
```

### 자동화 설정

```json
{
  "model": "claude-sonnet-4-6",
  "permissionMode": "acceptEdits",
  "maxTotalBudgetUsd": 20.0,
  "autoOnboarding": true,
  "logLevel": "warn"
}
```

### 보수적 설정

```json
{
  "permissionMode": "default",
  "maxBudgetPerTaskUsd": 0.2,
  "maxTotalBudgetUsd": 2.0,
  "maxTurnsPerTask": 10,
  "taskTimeoutMs": 300000,
  "allowedTools": ["Read", "Grep", "Glob"]
}
```
