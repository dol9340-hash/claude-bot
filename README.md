# ClaudeBot

자율적인 큐 기반 작업 오케스트레이터. Claude Agent SDK(기본) 또는 CLI(폴백) 하이브리드 엔진으로 마크다운 체크리스트의 작업을 순차 실행합니다.

## 사전 요구사항

- **Node.js 18+**
- 엔진 택 1:
  - **SDK 엔진** (기본): `ANTHROPIC_API_KEY` 환경변수
  - **CLI 엔진**: `claude` CLI 설치 + Max 구독

## 설치

```bash
git clone <repo-url>
cd claude-bot
npm install
npm run build
```

## 빠른 시작

### 1. 작업 파일 작성

`docs/todo.md` (기본 경로):

```markdown
- [ ] src/utils에 formatDate 유틸리티 함수 추가
- [ ] 기존 코드의 에러 핸들링 개선
- [ ] README에 API 문서 섹션 추가
```

인라인 태그로 작업별 옵션 지정 가능:

```markdown
- [ ] 인증 모듈 구현 [cwd:./packages/auth] [budget:5.00] [turns:30]
- [ ] QA 테스트 실행 [agent:reviewer]
```

| 태그 | 설명 | 예시 |
|------|------|------|
| `[cwd:경로]` | 작업 디렉토리 지정 | `[cwd:./backend]` |
| `[budget:금액]` | 작업별 예산 (USD) | `[budget:3.00]` |
| `[turns:횟수]` | 최대 에이전트 턴 수 | `[turns:50]` |
| `[agent:이름]` | 스웜 에이전트 지정 | `[agent:worker]` |

### 2. 실행

```bash
# 작업 큐 실행
npx claudebot run

# 작업 확인만 (실행 안 함)
npx claudebot run --dry-run

# CLI 엔진 사용
npx claudebot run --engine cli

# 예산 제한
npx claudebot run --max-budget 5.00

# 모델 지정
npx claudebot run --model claude-opus-4-6
```

실행 중 `Ctrl+C`로 안전하게 종료됩니다.

### 3. 배치 파일로 실행 (Windows)

설치/빌드/API Key 확인을 자동으로 처리합니다:

```bat
run.bat                    :: 작업 큐 실행
run.bat --dry-run          :: 작업 확인만
run.bat --engine cli       :: CLI 엔진
swarm.bat                  :: 멀티봇 스웜 실행
swarm.bat --dry-run        :: 토폴로지 확인만
status.bat                 :: 세션 이력/비용 확인
status.bat --swarm         :: 봇별 비용 표시
```

### 4. 상태 확인

```bash
npx claudebot status
```

## 작업 상태

실행 후 `docs/todo.md`가 자동 업데이트됩니다:

```markdown
- [x] 완료된 작업
- [!] 실패한 작업  <!-- FAILED: retry 2 -->
- [ ] 아직 대기 중인 작업
```

## 설정

`claudebot.config.json` (프로젝트 루트):

```json
{
  "engine": "sdk",
  "tasksFile": "docs/todo.md",
  "model": "claude-sonnet-4-6",
  "permissionMode": "acceptEdits",
  "maxBudgetPerTaskUsd": 2.00,
  "maxTotalBudgetUsd": 20.00,
  "taskTimeoutMs": 600000,
  "maxRetries": 2,
  "stopOnFailure": false,
  "logLevel": "info",
  "watchIntervalMs": 20000
}
```

| 옵션 | 기본값 | 설명 |
|------|--------|------|
| `engine` | `"sdk"` | `"sdk"` 또는 `"cli"` |
| `tasksFile` | `"docs/todo.md"` | 작업 마크다운 파일 경로 |
| `model` | - | Claude 모델 (예: `claude-sonnet-4-6`) |
| `permissionMode` | `"acceptEdits"` | `default` / `acceptEdits` / `bypassPermissions` |
| `maxBudgetPerTaskUsd` | - | 작업당 최대 예산 (USD) |
| `maxTotalBudgetUsd` | - | 전체 세션 최대 예산 |
| `taskTimeoutMs` | `600000` | 작업 타임아웃 (10분) |
| `maxRetries` | `2` | 실패 시 재시도 횟수 |
| `stopOnFailure` | `false` | 실패 시 큐 중단 여부 |
| `watchIntervalMs` | `20000` | 큐 비었을 때 폴링 간격 (0 = 즉시 종료) |

CLI 옵션이 설정 파일보다 우선합니다.

## BotGraph (멀티봇 스웜)

복수 봇이 역할을 나누어 협업하는 모드입니다.

### 스웜 설정 파일

`claudebot.swarm.json`:

```json
{
  "engine": "sdk",
  "permissionMode": "acceptEdits",
  "maxTotalBudgetUsd": 50.00,
  "swarmGraph": {
    "workspacePath": ".botspace",
    "entryBots": ["coordinator"],
    "bots": {
      "coordinator": {
        "model": "claude-opus-4-6",
        "systemPromptFile": "prompts/coordinator.md",
        "watchesFiles": ["docs/tasks/*.md"],
        "canContact": ["worker", "reviewer"],
        "maxBudgetPerTaskUsd": 5.00,
        "terminatesOnEmpty": true
      },
      "worker": {
        "model": "claude-sonnet-4-6",
        "canContact": ["coordinator"],
        "terminatesOnEmpty": false
      }
    },
    "message": { "routingStrategy": "explicit", "maxRoutingCycles": 3 },
    "termination": { "gracePeriodMs": 30000 }
  }
}
```

### 스웜 실행

```bash
# 토폴로지 확인 (실행 안 함)
npx claudebot swarm --dry-run

# 스웜 실행
npx claudebot swarm --config claudebot.swarm.json

# 봇별 비용 확인
npx claudebot status --swarm
```

예제: `examples/swarm-dev-team/`

## Dashboard

웹 기반 모니터링 대시보드:

```bash
cd dashboard
npm install
npm run dev
```

## CLI 레퍼런스

```
claudebot run [옵션]        작업 큐 실행
  -f, --file <path>         작업 파일 경로
  -c, --cwd <path>          작업 디렉토리
  -m, --model <model>       Claude 모델
  -e, --engine <type>       sdk | cli
  --max-retries <n>         재시도 횟수
  --max-budget <usd>        최대 예산 (USD)
  --timeout <ms>            타임아웃 (ms)
  --stop-on-failure         실패 시 중단
  --permission-mode <mode>  권한 모드
  --watch-interval <ms>     폴링 간격 (0=종료)
  --dry-run                 실행 없이 확인만

claudebot swarm [옵션]      멀티봇 스웜 실행
  --config <path>           스웜 설정 파일 (기본: claudebot.swarm.json)
  --dry-run                 토폴로지 확인만

claudebot status [옵션]     세션 이력/비용 확인
  --swarm                   봇별 비용 표시
```

## 라이선스

MIT
