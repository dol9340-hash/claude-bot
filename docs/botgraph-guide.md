# BotGraph 실전 사용 가이드

> ClaudeBot BotGraph (Section 10) — 멀티봇 협업 파이프라인 완전 가이드
> 버전: 2026-03-02 | 상태: Phase 2 구현 완료 ✅
>
> `claudebot swarm --config claudebot.swarm.json` 명령어로 멀티봇 스웜 실행 가능.

---

## 목차

1. [시작하기](#1-시작하기)
2. [소프트웨어 개발팀 시나리오](#2-소프트웨어-개발팀-시나리오)
3. [리서치팀 시나리오](#3-리서치팀-시나리오)
4. [데이터 파이프라인 시나리오](#4-데이터-파이프라인-시나리오)
5. [시스템 프롬프트 작성 가이드](#5-시스템-프롬프트-작성-가이드)
6. [메시지 프로토콜 규약](#6-메시지-프로토콜-규약)
7. [운영 팁](#7-운영-팁)
8. [고급 설정](#8-고급-설정)

---

## 1. 시작하기

### BotGraph란

BotGraph는 ClaudeBot의 멀티봇 협업 프레임워크입니다. 여러 Claude 인스턴스가 각자의 역할을 맡고, 파일 기반 메시지 채널을 통해 서로 통신하며 태스크 백로그를 자율적으로 소진합니다.

핵심 특징:
- **설정 주도(config-driven)**: `claudebot.swarm.json` 하나만 바꾸면 소프트웨어 개발팀, 리서치팀, 데이터 파이프라인 등 어떤 워크플로우도 구동됩니다.
- **외부 브로커 불필요**: Redis, RabbitMQ 없이 파일 I/O만으로 봇 간 통신합니다.
- **기존 ClaudeBot 재사용**: `ClaudeBot`, `parseTasks`, `SdkExecutor` 등 핵심 컴포넌트를 그대로 사용합니다.

### 최소 설정 예시

가장 단순한 2봇 구성으로 BotGraph를 시작해보겠습니다.

**디렉토리 구조:**

```
my-project/
├── claudebot.swarm.json
├── prompts/
│   ├── coordinator.md
│   └── worker.md
└── docs/
    └── tasks/
        └── task-001.md
```

**`claudebot.swarm.json` (최소 설정):**

```json
{
  "engine": "sdk",
  "permissionMode": "acceptEdits",
  "maxTotalBudgetUsd": 10.00,
  "watchIntervalMs": 15000,

  "swarmGraph": {
    "workspacePath": ".botspace",
    "boardFile": "board.md",
    "registryFile": "registry.json",
    "stuckTaskTimeoutMs": 600000,
    "entryBots": ["coordinator"],

    "bots": {
      "coordinator": {
        "model": "claude-opus-4-6",
        "systemPromptFile": "prompts/coordinator.md",
        "watchesFiles": ["docs/tasks/*.md"],
        "canContact": ["worker"],
        "workspaceDir": "coordinator",
        "maxBudgetPerTaskUsd": 3.00,
        "maxTurnsPerTask": 20,
        "terminatesOnEmpty": true,
        "allowedTools": ["Read", "Write", "Edit", "Grep", "Glob"]
      },
      "worker": {
        "model": "claude-sonnet-4-6",
        "systemPromptFile": "prompts/worker.md",
        "watchesFiles": [],
        "canContact": ["coordinator"],
        "workspaceDir": "worker",
        "maxBudgetPerTaskUsd": 5.00,
        "maxTurnsPerTask": 40,
        "terminatesOnEmpty": false,
        "allowedTools": ["Read", "Write", "Edit", "Grep", "Glob", "Bash"]
      }
    },

    "message": {
      "routingStrategy": "explicit",
      "format": "envelope",
      "maxRoutingCycles": 3
    },
    "termination": {
      "gracePeriodMs": 30000
    }
  }
}
```

### 프롬프트 파일 폴더 구성

프롬프트 파일은 `prompts/` 디렉토리에 봇 이름과 동일한 파일명으로 저장합니다:

```
prompts/
├── coordinator.md    # coordinator 봇의 시스템 프롬프트
└── worker.md         # worker 봇의 시스템 프롬프트
```

`systemPromptFile` 대신 `systemPrompt` 키로 JSON 내에 직접 인라인으로 작성할 수도 있지만, 유지보수를 위해 파일 분리를 권장합니다.

### 실행 명령

```bash
# 스웜 실행
claudebot swarm --config claudebot.swarm.json

# 상태 확인 (실행 중)
claudebot status --swarm
```

---

## 2. 소프트웨어 개발팀 시나리오

### 개요

가장 일반적인 BotGraph 사용 사례입니다. coordinator(기획/오케스트레이터), worker(개발자), reviewer(QA) 세 봇이 협력하여 개발 태스크를 자율 처리합니다.

**역할 분담:**
- `coordinator` (Opus 모델): 태스크 파일 감시 → worker에게 할당 → 전체 진행 관리
- `worker` (Sonnet 모델): 실제 코드 작성, 파일 수정, 구현 수행
- `reviewer` (Sonnet 모델, 읽기 전용): 코드 리뷰, 테스트 검증, 승인/반려

### 완전한 `claudebot.swarm.json`

```json
{
  "engine": "sdk",
  "permissionMode": "acceptEdits",
  "maxTotalBudgetUsd": 50.00,
  "watchIntervalMs": 15000,

  "swarmGraph": {
    "workspacePath": ".botspace",
    "boardFile": "board.md",
    "registryFile": "registry.json",
    "stuckTaskTimeoutMs": 600000,
    "entryBots": ["coordinator"],

    "bots": {
      "coordinator": {
        "model": "claude-opus-4-6",
        "systemPromptFile": "prompts/coordinator.md",
        "watchesFiles": ["docs/tasks/*.md"],
        "canContact": ["worker", "reviewer"],
        "workspaceDir": "coordinator",
        "maxBudgetPerTaskUsd": 5.00,
        "maxTurnsPerTask": 30,
        "terminatesOnEmpty": true,
        "allowedTools": ["Read", "Write", "Edit", "Grep", "Glob"]
      },
      "worker": {
        "model": "claude-sonnet-4-6",
        "systemPromptFile": "prompts/worker.md",
        "watchesFiles": [],
        "canContact": ["coordinator", "reviewer"],
        "workspaceDir": "worker",
        "maxBudgetPerTaskUsd": 10.00,
        "maxTurnsPerTask": 60,
        "terminatesOnEmpty": false,
        "allowedTools": ["Read", "Write", "Edit", "Grep", "Glob", "Bash"]
      },
      "reviewer": {
        "model": "claude-sonnet-4-6",
        "systemPromptFile": "prompts/reviewer.md",
        "watchesFiles": [],
        "canContact": ["coordinator", "worker"],
        "workspaceDir": "reviewer",
        "maxBudgetPerTaskUsd": 3.00,
        "maxTurnsPerTask": 20,
        "terminatesOnEmpty": false,
        "allowedTools": ["Read", "Grep", "Glob", "Bash"]
      }
    },

    "message": {
      "routingStrategy": "explicit",
      "format": "envelope",
      "maxRoutingCycles": 3
    },
    "termination": {
      "gracePeriodMs": 30000
    }
  }
}
```

### 시스템 프롬프트 파일 예시

#### `prompts/coordinator.md`

```markdown
# Coordinator Bot — 소프트웨어 개발팀 오케스트레이터

## 역할
당신은 소프트웨어 개발팀의 프로젝트 코디네이터입니다. 태스크 파일을 분석하고,
적절한 담당자에게 작업을 배정하며, 전체 개발 진행 상황을 관리합니다.

## 책임
- `docs/tasks/*.md` 파일에서 미완료 태스크를 발견하면 worker에게 할당합니다.
- reviewer로부터 APPROVED 메시지를 받으면 해당 태스크를 완료 처리합니다.
- reviewer로부터 REWORK 메시지를 받으면 worker에게 재작업을 지시합니다.
- 모든 태스크가 완료되거나 실패하면 SWARM_COMPLETE를 board.md에 게시합니다.
- worker로부터 QUESTION 메시지를 받으면 즉시 답변합니다.

## 워크플로우

### 새 태스크 발견 시
1. `docs/tasks/task-NNN.md` 파일을 읽어 요구사항을 파악합니다.
2. `.botspace/registry.json`에 태스크를 `pending` 상태로 등록합니다.
3. `.botspace/board.md`에 할당 내용을 게시합니다.
4. worker의 인박스(`.botspace/inbox/worker.md`)에 ASSIGN 메시지를 씁니다:
   ```
   - [ ] MSG-NNN | from:coordinator | to:worker | subject:ASSIGN | taskId:task-NNN | See docs/tasks/task-NNN.md
   ```
5. registry에서 태스크 상태를 `assigned`로 업데이트합니다.

### APPROVED 수신 시 (reviewer로부터)
1. registry에서 태스크 상태를 `done`으로 업데이트합니다.
2. board.md에 완료 항목을 게시합니다.
3. 다음 pending 태스크를 확인합니다.

### REWORK 수신 시 (reviewer로부터)
1. rework 횟수가 `maxRoutingCycles`(3회)를 초과하면 태스크를 `failed`로 표시합니다.
2. 초과하지 않으면 worker에게 REWORK 메시지를 전달합니다:
   ```
   - [ ] MSG-NNN | from:coordinator | to:worker | subject:REWORK | taskId:task-NNN | See .botspace/reviewer/task-NNN-rN.md
   ```

### 모든 태스크 처리 완료 시
board.md에 다음을 게시합니다:
```
## SWARM_COMPLETE
All tasks processed. Shutting down.
```

## 연락 가능한 봇
- `worker`: 개발 작업 할당 및 지시
- `reviewer`: 리뷰 요청 (직접 연락은 드묾, 주로 worker가 reviewer에게 연락함)

## 중요 규칙
- 코드를 직접 작성하지 마십시오. 항상 worker에게 위임하십시오.
- 인박스 메시지의 `[x]` 처리된 항목은 이미 완료된 것입니다. 건너뜁니다.
- registry.json은 원자적으로 읽고 써야 합니다 (.registry.lock 확인).
```

#### `prompts/worker.md`

```markdown
# Worker Bot — 소프트웨어 개발자

## 역할
당신은 소프트웨어 개발팀의 개발자입니다. coordinator로부터 할당받은 태스크를
구현하고, reviewer의 피드백을 반영하여 코드를 개선합니다.

## 책임
- coordinator로부터 ASSIGN 메시지를 받으면 해당 태스크를 구현합니다.
- 구현 완료 후 reviewer에게 READY_FOR_REVIEW 메시지를 보냅니다.
- reviewer로부터 REWORK 메시지를 받으면 피드백을 반영하여 재작업합니다.
- 불명확한 요구사항이 있으면 coordinator에게 QUESTION 메시지를 보냅니다.

## 워크플로우

### ASSIGN 수신 시 (coordinator로부터)
1. 인박스 메시지에서 `taskId`와 태스크 파일 경로를 파악합니다.
2. 태스크 파일(`docs/tasks/task-NNN.md`)을 읽어 요구사항을 이해합니다.
3. registry에서 태스크 상태를 `in_progress`로 업데이트합니다.
4. board.md에 작업 시작을 게시합니다.
5. 코드를 구현합니다 (Read, Write, Edit, Grep, Glob, Bash 도구 사용 가능).
6. 구현 완료 후 `.botspace/reviewer/task-NNN.md`에 리뷰 요청 노트를 작성합니다.
7. reviewer 인박스에 READY_FOR_REVIEW 메시지를 씁니다:
   ```
   - [ ] MSG-NNN | from:worker | to:reviewer | subject:READY_FOR_REVIEW | taskId:task-NNN | See .botspace/reviewer/task-NNN.md
   ```
8. registry에서 태스크 상태를 `reviewing`으로 업데이트합니다.

### REWORK 수신 시 (coordinator 또는 reviewer로부터)
1. 피드백 파일(`.botspace/reviewer/task-NNN-rN.md`)을 읽습니다.
2. 피드백 내용을 바탕으로 코드를 수정합니다.
3. 수정 완료 후 새 리뷰 노트를 작성합니다 (`.botspace/reviewer/task-NNN-rN+1.md`).
4. reviewer 인박스에 다시 READY_FOR_REVIEW를 보냅니다.

### QUESTION 전송 방법 (coordinator에게)
불명확한 요구사항 발견 시:
1. coordinator 인박스에 QUESTION 메시지를 씁니다:
   ```
   - [ ] MSG-NNN | from:worker | to:coordinator | subject:QUESTION | taskId:task-NNN | [질문 내용]
   ```
2. registry에서 태스크 상태를 `paused`로 업데이트합니다.
3. 응답을 기다립니다 (다음 인박스 확인 사이클에서 ANSWER 확인).

## 리뷰 노트 형식 (`.botspace/reviewer/task-NNN.md`)
```markdown
# 리뷰 요청: task-NNN

## 구현 요약
[무엇을 구현했는지 간략히 설명]

## 변경된 파일
- `src/module/file.ts` — [변경 내용]
- `tests/module/file.test.ts` — [테스트 추가 내용]

## 테스트 실행 결과
[테스트 명령과 결과]

## 특이 사항
[reviewer가 알아야 할 사항]
```

## 연락 가능한 봇
- `coordinator`: 질문, 진행 상황 보고
- `reviewer`: 리뷰 요청

## 중요 규칙
- 한 번에 하나의 태스크만 처리합니다.
- 구현 전 반드시 기존 코드 구조를 파악합니다 (Grep, Glob 활용).
- 테스트는 반드시 실행하여 통과 여부를 확인합니다.
```

#### `prompts/reviewer.md`

```markdown
# Reviewer Bot — QA 엔지니어

## 역할
당신은 소프트웨어 개발팀의 QA 엔지니어입니다. worker가 구현한 코드를 검토하고,
품질 기준을 충족하면 승인, 미충족 시 구체적인 피드백과 함께 반려합니다.

## 책임
- worker로부터 READY_FOR_REVIEW 메시지를 받으면 코드를 검토합니다.
- 품질 기준 충족 시 coordinator에게 APPROVED 메시지를 보냅니다.
- 미충족 시 coordinator에게 REWORK 메시지와 상세 피드백을 보냅니다.

## 워크플로우

### READY_FOR_REVIEW 수신 시 (worker로부터)
1. 리뷰 노트(`.botspace/reviewer/task-NNN.md`)를 읽습니다.
2. 변경된 파일들을 모두 읽고 검토합니다.
3. 가능한 경우 Bash로 테스트를 실행합니다.

### 검토 기준
- [ ] 요구사항의 모든 항목이 구현되었는가?
- [ ] 기존 테스트가 모두 통과하는가?
- [ ] 새로 추가된 코드에 적절한 테스트가 있는가?
- [ ] 명백한 버그나 보안 취약점이 없는가?
- [ ] 코드 스타일이 기존 코드베이스와 일관성이 있는가?

### 승인 시 (APPROVED)
coordinator 인박스에 다음을 씁니다:
```
- [ ] MSG-NNN | from:reviewer | to:coordinator | subject:APPROVED | taskId:task-NNN | All checks passed.
```

### 반려 시 (REWORK)
1. `.botspace/reviewer/task-NNN-rN.md`에 피드백 파일을 작성합니다:
   ```markdown
   # 리뷰 피드백: task-NNN (Round N)

   ## 상태: REWORK 필요

   ## 문제점
   1. [구체적인 문제 설명 및 파일/라인 명시]
   2. [또 다른 문제]

   ## 필요한 수정 사항
   - [구체적인 수정 지시]
   ```
2. coordinator 인박스에 REWORK 메시지를 씁니다:
   ```
   - [ ] MSG-NNN | from:reviewer | to:coordinator | subject:REWORK | taskId:task-NNN | See .botspace/reviewer/task-NNN-rN.md
   ```

## 연락 가능한 봇
- `coordinator`: 승인/반려 결과 보고
- `worker`: (필요 시) 직접 질문 (드묾)

## 중요 규칙
- 코드를 직접 수정하지 마십시오 (Write, Edit 도구가 없습니다).
- 모호한 요구사항은 coordinator에게 질문하십시오 (worker에게 직접 묻지 마십시오).
- 피드백은 반드시 구체적이고 실행 가능하게 작성하십시오.
```

### 실제 태스크 파일 예시

**`docs/tasks/task-001.md`:**

```markdown
# task-001: JWT 인증 미들웨어 구현

## 우선순위
높음

## 요구사항
Express.js 애플리케이션에 JWT 기반 인증 미들웨어를 구현합니다.

### 기능 요구사항
1. `POST /auth/login` 엔드포인트: 이메일/패스워드 검증 후 JWT 발급
2. `authenticateToken` 미들웨어: Authorization 헤더에서 Bearer 토큰 추출 및 검증
3. 토큰 만료 시 401 응답, 유효하지 않은 토큰 시 403 응답

### 기술 요구사항
- 알고리즘: RS256 (공개키/비공개키 방식)
- 만료 시간: 1시간
- 키 파일 경로: `config/keys/private.pem`, `config/keys/public.pem`
- 라이브러리: `jsonwebtoken` (이미 설치됨)

### 테스트 요구사항
- `tests/auth/jwt.test.ts`에 단위 테스트 작성
- 유효 토큰, 만료 토큰, 잘못된 토큰 케이스 포함

## 완료 기준
- 모든 테스트 통과 (`npm test`)
- `src/middleware/auth.ts` 파일 생성
- `src/routes/auth.ts` 파일 생성 또는 업데이트

## 참고 파일
- `src/app.ts` — 미들웨어 등록 위치
- `config/security.md` — 보안 정책
```

### 실제 작업 흐름 단계별 설명

```
[1단계] 시작
  claudebot swarm --config claudebot.swarm.json

[2단계] coordinator 활성화
  coordinator가 docs/tasks/*.md를 스캔
  → task-001.md 발견
  → registry.json에 {taskId: "task-001", state: "pending"} 등록
  → board.md에 "Assigning task-001 to worker" 게시
  → .botspace/inbox/worker.md에 ASSIGN 메시지 작성

[3단계] worker 활성화
  worker가 인박스에서 ASSIGN 메시지 확인
  → task-001.md 읽기
  → registry 상태를 "in_progress"로 업데이트
  → 코드 구현 시작 (src/middleware/auth.ts 작성 등)
  → npm test 실행으로 테스트 통과 확인
  → .botspace/reviewer/task-001.md에 리뷰 노트 작성
  → .botspace/inbox/reviewer.md에 READY_FOR_REVIEW 메시지 작성
  → registry 상태를 "reviewing"으로 업데이트

[4a단계] reviewer 승인 시
  reviewer가 코드 검토
  → 모든 기준 통과
  → .botspace/inbox/coordinator.md에 APPROVED 메시지 작성
  → coordinator가 registry 상태를 "done"으로 업데이트
  → 다음 태스크로 진행

[4b단계] reviewer 반려 시
  reviewer가 코드 검토
  → 문제 발견 (예: HS256 사용, RS256 요구됨)
  → .botspace/reviewer/task-001-r1.md에 피드백 작성
  → .botspace/inbox/coordinator.md에 REWORK 메시지 작성
  → coordinator가 worker에게 REWORK 메시지 전달
  → worker가 피드백 반영 후 재작업 (최대 3회)

[5단계] 종료
  모든 태스크 done/failed
  → coordinator가 board.md에 SWARM_COMPLETE 게시
  → orchestrator가 30초 후 모든 봇 종료
```

---

## 3. 리서치팀 시나리오

### 개요

lead + researcher + writer + editor 4봇 구성으로 리서치 보고서를 자율 생성합니다.

**역할 분담:**
- `lead` (Opus): 리서치 브리프 감시, 작업 조율, 최종 승인
- `researcher` (Sonnet): 웹 검색, 데이터 수집, 소스 정리
- `writer` (Sonnet): 보고서 초안 작성
- `editor` (Sonnet, 읽기 전용): 문서 교정, 사실 확인, 품질 검수

### 완전한 `claudebot.swarm.json`

```json
{
  "engine": "sdk",
  "permissionMode": "acceptEdits",
  "maxTotalBudgetUsd": 30.00,
  "watchIntervalMs": 20000,

  "swarmGraph": {
    "workspacePath": ".botspace",
    "boardFile": "board.md",
    "registryFile": "registry.json",
    "stuckTaskTimeoutMs": 900000,
    "entryBots": ["lead"],

    "bots": {
      "lead": {
        "model": "claude-opus-4-6",
        "systemPromptFile": "prompts/lead.md",
        "watchesFiles": ["docs/briefs/*.md"],
        "canContact": ["researcher", "writer", "editor"],
        "workspaceDir": "lead",
        "maxBudgetPerTaskUsd": 4.00,
        "maxTurnsPerTask": 25,
        "terminatesOnEmpty": true,
        "allowedTools": ["Read", "Write", "Edit", "Grep", "Glob"]
      },
      "researcher": {
        "model": "claude-sonnet-4-6",
        "systemPromptFile": "prompts/researcher.md",
        "watchesFiles": [],
        "canContact": ["lead", "writer"],
        "workspaceDir": "researcher",
        "maxBudgetPerTaskUsd": 8.00,
        "maxTurnsPerTask": 50,
        "terminatesOnEmpty": false,
        "allowedTools": ["Read", "Write", "Grep", "Glob", "Bash"]
      },
      "writer": {
        "model": "claude-sonnet-4-6",
        "systemPromptFile": "prompts/writer.md",
        "watchesFiles": [],
        "canContact": ["lead", "researcher", "editor"],
        "workspaceDir": "writer",
        "maxBudgetPerTaskUsd": 6.00,
        "maxTurnsPerTask": 40,
        "terminatesOnEmpty": false,
        "allowedTools": ["Read", "Write", "Edit", "Grep", "Glob"]
      },
      "editor": {
        "model": "claude-sonnet-4-6",
        "systemPromptFile": "prompts/editor.md",
        "watchesFiles": [],
        "canContact": ["lead", "writer"],
        "workspaceDir": "editor",
        "maxBudgetPerTaskUsd": 2.00,
        "maxTurnsPerTask": 15,
        "terminatesOnEmpty": false,
        "allowedTools": ["Read", "Grep", "Glob"]
      }
    },

    "message": {
      "routingStrategy": "explicit",
      "format": "envelope",
      "maxRoutingCycles": 2
    },
    "termination": {
      "gracePeriodMs": 30000
    }
  }
}
```

### 각 봇의 시스템 프롬프트 요점

**`prompts/lead.md` 핵심 내용:**
- `docs/briefs/*.md`에서 리서치 브리프 파일 감시
- researcher에게 `RESEARCH_REQUEST` 메시지로 조사 요청
- researcher 완료 후 writer에게 `WRITE_REQUEST` 메시지 전달
- editor의 `APPROVED` 또는 `REVISION_NEEDED` 처리
- 주제어, 목표 독자, 분량, 마감 등 브리프 메타데이터 포함 전달

**`prompts/researcher.md` 핵심 내용:**
- `RESEARCH_REQUEST` 수신 시 해당 주제 집중 조사
- 수집 결과를 `.botspace/researcher/{taskId}-sources.md`에 정리
- 각 소스에 URL, 신뢰도, 핵심 내용 요약 포함
- 조사 완료 후 writer에게 `RESEARCH_DONE` 메시지 전송

**`prompts/writer.md` 핵심 내용:**
- `WRITE_REQUEST` 또는 `RESEARCH_DONE` 수신 시 보고서 초안 작성
- `.botspace/researcher/{taskId}-sources.md` 참조하여 근거 있는 내용 작성
- 완성된 보고서를 `docs/reports/{taskId}-draft.md`에 저장
- editor에게 `COPY_READY` 메시지 전송

**`prompts/editor.md` 핵심 내용:**
- `COPY_READY` 수신 시 보고서 교정 및 검수
- 사실 확인, 논리 일관성, 문법, 가독성 체크
- 품질 기준 충족 시 lead에게 `APPROVED` 전송
- 미충족 시 `.botspace/editor/{taskId}-feedback.md`에 피드백 작성 후 lead에게 `REVISION_NEEDED` 전송

### 적합한 사용 케이스

- 시장 조사 보고서 자동 생성 (경쟁사 분석, 트렌드 리포트)
- 기술 문서 리서치 및 작성 (API 비교, 프레임워크 평가)
- 뉴스레터 콘텐츠 파이프라인 (주기적 정보 수집 → 정리 → 발행)
- 학술 문헌 검토 및 요약 보고서

---

## 4. 데이터 파이프라인 시나리오

### 개요

planner + coder + tester 3봇 구성으로 데이터 처리 파이프라인을 설계, 구현, 검증합니다.

**역할 분담:**
- `planner` (Opus): 파이프라인 명세 감시, 설계 문서 작성, 전체 조율
- `coder` (Sonnet): 파이프라인 스크립트 및 코드 구현
- `tester` (Sonnet, 읽기 전용): 데이터 유효성 검증, 파이프라인 테스트 실행

### 완전한 `claudebot.swarm.json`

```json
{
  "engine": "sdk",
  "permissionMode": "acceptEdits",
  "maxTotalBudgetUsd": 40.00,
  "watchIntervalMs": 15000,

  "swarmGraph": {
    "workspacePath": ".botspace",
    "boardFile": "board.md",
    "registryFile": "registry.json",
    "stuckTaskTimeoutMs": 1200000,
    "entryBots": ["planner"],

    "bots": {
      "planner": {
        "model": "claude-opus-4-6",
        "systemPromptFile": "prompts/planner.md",
        "watchesFiles": ["docs/pipelines/*.md"],
        "canContact": ["coder", "tester"],
        "workspaceDir": "planner",
        "maxBudgetPerTaskUsd": 5.00,
        "maxTurnsPerTask": 25,
        "terminatesOnEmpty": true,
        "allowedTools": ["Read", "Write", "Edit", "Grep", "Glob"]
      },
      "coder": {
        "model": "claude-sonnet-4-6",
        "systemPromptFile": "prompts/coder.md",
        "watchesFiles": [],
        "canContact": ["planner", "tester"],
        "workspaceDir": "coder",
        "maxBudgetPerTaskUsd": 12.00,
        "maxTurnsPerTask": 80,
        "terminatesOnEmpty": false,
        "allowedTools": ["Read", "Write", "Edit", "Grep", "Glob", "Bash"]
      },
      "tester": {
        "model": "claude-sonnet-4-6",
        "systemPromptFile": "prompts/tester.md",
        "watchesFiles": [],
        "canContact": ["planner", "coder"],
        "workspaceDir": "tester",
        "maxBudgetPerTaskUsd": 4.00,
        "maxTurnsPerTask": 30,
        "terminatesOnEmpty": false,
        "allowedTools": ["Read", "Grep", "Glob", "Bash"]
      }
    },

    "message": {
      "routingStrategy": "explicit",
      "format": "envelope",
      "maxRoutingCycles": 3
    },
    "termination": {
      "gracePeriodMs": 60000
    }
  }
}
```

### 적합한 사용 케이스

- ETL 파이프라인 자동 구현 (CSV/JSON 정제, DB 적재 스크립트)
- 데이터 품질 검증 스크립트 자동 생성 (스키마 검사, 이상값 탐지)
- 데이터 마이그레이션 스크립트 작성 및 검증
- 주기적 데이터 변환 작업 자동화 (크론 잡 스크립트 생성)
- 대용량 로그 분석 파이프라인 구현

**`prompts/planner.md` 핵심 내용:**
- `docs/pipelines/*.md`에서 파이프라인 명세 파일 감시
- 명세를 읽고 `.botspace/planner/{taskId}-design.md`에 설계 문서 작성
- coder에게 `IMPLEMENT_PIPELINE` 메시지와 함께 설계 문서 경로 전달

**`prompts/coder.md` 핵심 내용:**
- 설계 문서를 바탕으로 파이프라인 스크립트 구현
- 구현 완료 후 tester에게 `READY_FOR_TEST` 메시지 전송
- 샘플 데이터로 로컬 실행 테스트 포함

**`prompts/tester.md` 핵심 내용:**
- 파이프라인 스크립트를 샘플 데이터로 실행 (Bash)
- 출력 데이터 스키마 검증 및 품질 체크
- 통과 시 planner에게 `TESTS_PASSED`, 실패 시 `TESTS_FAILED` 전송

---

## 5. 시스템 프롬프트 작성 가이드

### 효과적인 봇 시스템 프롬프트의 구성 요소

좋은 시스템 프롬프트는 봇이 스스로 판단하고 행동할 수 있는 충분한 컨텍스트를 제공합니다.

**필수 구성 요소:**

1. **역할 정의** — 봇이 팀에서 맡은 역할과 전문성 명시
2. **책임 범위** — 해야 할 것과 하지 말아야 할 것 명시
3. **워크플로우 지시** — 각 이벤트(메시지 수신)별 구체적인 행동 절차
4. **canContact 활용법** — 어떤 봇에게 어떤 상황에서 연락하는지 명시
5. **메시지 처리 방법** — 인박스 메시지 형식과 각 subject별 처리 방법
6. **파일 위치 규약** — 작업 산출물을 어디에 저장하는지 명시
7. **중요 규칙** — 절대 해서는 안 되는 행동 목록

### 필수 포함 내용 상세

#### 역할 정의
```markdown
## 역할
당신은 [팀명]의 [직책]입니다. 당신의 전문성은 [핵심 역량]이며,
[무엇을 달성하기 위해] 협력합니다.
```

#### 워크플로우 지시 (트리거 → 행동)
```markdown
## 워크플로우

### [SUBJECT_NAME] 수신 시 ([발신봇]으로부터)
1. [첫 번째 행동]
2. [두 번째 행동]
3. [산출물 저장 위치]
4. [다음 봇에게 보낼 메시지 형식]
```

#### canContact 활용법
```markdown
## 연락 가능한 봇
- `[botName]`: [어떤 상황에서 연락], [어떤 subject 사용]
- `[botName]`: [어떤 상황에서 연락], [어떤 subject 사용]
```

#### 메시지 처리 방법
봇이 인박스를 읽을 때 미처리 메시지(`[ ]`)만 처리하고,
처리 후에는 반드시 `[x]`로 표시해야 함을 명시합니다.

```markdown
## 인박스 처리 규칙
- 인박스 파일에서 `[ ]`(미처리) 메시지만 처리합니다.
- 처리 완료된 메시지는 `[x]`로 업데이트합니다.
- `[x]` 메시지는 건너뜁니다.
```

### 피해야 할 패턴

**역할 경계 모호화:**
```markdown
# 나쁜 예시
당신은 개발자이며 필요하면 리뷰도 할 수 있습니다.
```
```markdown
# 좋은 예시
당신은 개발자입니다. 코드 리뷰는 반드시 reviewer 봇이 담당합니다.
직접 리뷰하지 마십시오.
```

**메시지 형식 미명시:**
```markdown
# 나쁜 예시
작업 완료 후 reviewer에게 알려주십시오.
```
```markdown
# 좋은 예시
작업 완료 후 reviewer 인박스(.botspace/inbox/reviewer.md)에 다음 형식으로 작성합니다:
- [ ] MSG-NNN | from:worker | to:reviewer | subject:READY_FOR_REVIEW | taskId:task-NNN | See .botspace/reviewer/task-NNN.md
```

**파일 경로 미지정:**
```markdown
# 나쁜 예시
리뷰 노트를 작성하십시오.
```
```markdown
# 좋은 예시
리뷰 노트를 .botspace/reviewer/task-NNN.md 형식으로 저장합니다.
NNN은 taskId에서 숫자 부분입니다.
```

**registry 업데이트 누락:**
모든 상태 전환(pending → assigned → in_progress 등)에서 registry.json 업데이트를 명시해야 합니다.

### 재사용 가능한 시스템 프롬프트 템플릿

```markdown
# [BotName] Bot — [팀명] [역할]

## 역할
당신은 [팀명]의 [역할]입니다. [전문성과 목적].

## 책임
- [주요 책임 1]
- [주요 책임 2]
- [주요 책임 3]

## 워크플로우

### [TRIGGER_SUBJECT] 수신 시 ([발신봇]으로부터)
1. 인박스 메시지에서 `taskId`와 관련 파일 경로를 파악합니다.
2. [관련 파일] 읽기.
3. `.botspace/registry.json`에서 태스크 상태를 `[new_state]`로 업데이트합니다.
4. `.botspace/board.md`에 진행 상황을 게시합니다.
5. [주요 작업 수행].
6. 산출물을 `[산출물 경로]`에 저장합니다.
7. [다음봇] 인박스에 [NEXT_SUBJECT] 메시지를 씁니다:
   ```
   - [ ] MSG-NNN | from:[botName] | to:[nextBot] | subject:[NEXT_SUBJECT] | taskId:[taskId] | See [경로]
   ```
8. registry에서 태스크 상태를 `[next_state]`로 업데이트합니다.

### [ANOTHER_TRIGGER] 수신 시
[처리 절차...]

## 인박스 처리 규칙
- 인박스 파일에서 `[ ]`(미처리) 메시지만 처리합니다.
- 처리 완료된 메시지는 `[x]`로 업데이트합니다.
- `[x]` 메시지는 건너뜁니다.

## 연락 가능한 봇
- `[botName1]`: [언제, 무슨 목적으로]
- `[botName2]`: [언제, 무슨 목적으로]

## 산출물 저장 위치
- 작업 산출물: `.botspace/[botName]/task-NNN-[type].md`
- 피드백 문서: `.botspace/[botName]/task-NNN-feedback.md`

## 중요 규칙
- [절대 하면 안 되는 것 1]
- [절대 하면 안 되는 것 2]
- [핵심 행동 원칙]
```

---

## 6. 메시지 프로토콜 규약

### 메시지 엔벨롭 형식

BotGraph의 모든 봇 간 메시지는 다음 형식의 마크다운 체크박스 한 줄로 표현됩니다:

```
- [ ] MSG-{NNN} | from:{발신봇} | to:{수신봇} | subject:{주제} | taskId:{태스크ID} | {자유 텍스트}
```

**각 필드 설명:**

| 필드 | 타입 | 필수 | 설명 |
|------|------|------|------|
| `MSG-NNN` | 자동 증가 숫자 | 필수 | 메시지 고유 식별자 |
| `from` | 봇 이름 | 필수 | 발신 봇 (canContact 검증 대상) |
| `to` | 봇 이름 | 필수 | 수신 봇 |
| `subject` | 자유 문자열 | 필수 | 메시지의 의미론적 레이블 |
| `taskId` | 문자열 | 선택 | registry.json의 태스크 참조 |
| 자유 텍스트 | 문자열 | 선택 | 사람이 읽기 위한 컨텍스트, 파일 경로 등 |

**인박스 파일 예시 (`.botspace/inbox/worker.md`):**

```markdown
# Worker Inbox

- [x] MSG-001 | from:coordinator | to:worker | subject:ASSIGN | taskId:task-000 | See docs/tasks/task-000.md
- [x] MSG-003 | from:coordinator | to:worker | subject:REWORK | taskId:task-000 | See .botspace/reviewer/task-000-r1.md
- [ ] MSG-007 | from:coordinator | to:worker | subject:ASSIGN | taskId:task-001 | See docs/tasks/task-001.md
- [ ] MSG-009 | from:reviewer | to:worker | subject:QUESTION | taskId:task-001 | RS256 키 파일 경로를 확인해주세요.
```

처리된 메시지는 `[x]`로 표시됩니다. 이는 ClaudeBot의 기존 `parseTasks` 로직이 그대로 처리합니다.

### subject 네이밍 컨벤션 권장사항

BotGraph에서 `subject`는 자유 형식이지만, 팀 내에서 일관된 규약을 정하면 프롬프트 작성과 디버깅이 훨씬 수월해집니다.

**권장 형식:** 대문자 스네이크 케이스 (UPPER_SNAKE_CASE)

```
ASSIGN           # 태스크 할당
REWORK           # 재작업 요청
QUESTION         # 질문
ANSWER           # 질문 답변
READY_FOR_REVIEW # 리뷰 요청
APPROVED         # 승인
REJECTED         # 거절 (일반적)
TESTS_FAILED     # 테스트 실패
TESTS_PASSED     # 테스트 통과
COPY_READY       # 문서 작성 완료
RESEARCH_DONE    # 조사 완료
SWARM_COMPLETE   # 전체 작업 종료 (board.md에만 사용)
```

### 좋은 예시 / 나쁜 예시

**좋은 메시지 예시:**

```markdown
- [ ] MSG-042 | from:coordinator | to:worker | subject:ASSIGN | taskId:task-007 | See docs/tasks/task-007.md
```
- subject가 명확하고 대문자 스네이크 케이스
- taskId가 registry와 동일
- 자유 텍스트에 파일 경로 포함

```markdown
- [ ] MSG-043 | from:reviewer | to:coordinator | subject:REWORK | taskId:task-007 | See .botspace/reviewer/task-007-r1.md
```
- 피드백 파일 경로를 명확히 참조

**나쁜 메시지 예시:**

```markdown
- [ ] from:coordinator to:worker 태스크 처리해주세요
```
- MSG-NNN 없음 (추적 불가)
- 파이프(`|`) 구분자 없음 (파싱 실패)
- subject 없음 (봇이 처리 방법 판단 불가)
- taskId 없음 (registry 연동 불가)

```markdown
- [ ] MSG-044 | from:coordinator | to:worker | subject:assign | taskId:task007 | work on this
```
- subject 소문자 (일관성 없음)
- taskId 형식 불일치 (`task007` vs `task-007`)
- 자유 텍스트가 모호함 (파일 경로 없음)

---

## 7. 운영 팁

### 워크스페이스(.botspace/) 모니터링

BotGraph 실행 중 `.botspace/` 디렉토리를 주기적으로 확인하면 전체 상황을 파악할 수 있습니다.

**디렉토리 구조 확인:**

```bash
# 워크스페이스 전체 구조
ls -la .botspace/
ls -la .botspace/inbox/

# 각 봇의 인박스 현황
cat .botspace/inbox/coordinator.md
cat .botspace/inbox/worker.md
cat .botspace/inbox/reviewer.md
```

**실시간 board.md 모니터링:**

```bash
# macOS/Linux
tail -f .botspace/board.md

# Windows (PowerShell)
Get-Content .botspace/board.md -Wait
```

### board.md로 진행 상황 추적

`board.md`는 모든 봇의 활동이 타임스탬프와 함께 기록되는 공용 감사 로그입니다. 진행 상황 파악에 가장 유용한 파일입니다.

**정상적인 진행 예시:**

```markdown
## 2026-02-28T14:00:00Z | coordinator | ASSIGN
Assigning task-001 "JWT 인증 미들웨어 구현" to worker.

## 2026-02-28T14:00:05Z | worker | ACK
Acknowledged task-001. Starting implementation.

## 2026-02-28T15:30:00Z | worker | READY_FOR_REVIEW
task-001 implementation complete. Requesting review.

## 2026-02-28T15:45:00Z | reviewer | REWORK
task-001: RS256 알고리즘 미적용. 피드백 참조: .botspace/reviewer/task-001-r1.md

## 2026-02-28T16:10:00Z | worker | READY_FOR_REVIEW
task-001 rework complete (round 2).

## 2026-02-28T16:20:00Z | reviewer | APPROVED
task-001 approved. All checks passed.

## 2026-02-28T16:20:05Z | coordinator | COMPLETE
task-001 marked done. 0 tasks remaining. Initiating SWARM_COMPLETE.
```

**문제 신호 패턴:**
- 같은 taskId로 REWORK가 3회 이상 반복 → maxRoutingCycles 초과 임박
- 특정 봇의 ACK 후 장시간 다음 메시지 없음 → stuckTaskTimeoutMs 확인
- 같은 봇에서 짧은 시간 내 동일 subject 반복 → 루프 발생 의심

### registry.json으로 태스크 상태 확인

`registry.json`은 모든 태스크의 현재 상태를 담은 정규 소스입니다.

**예시 registry.json:**

```json
{
  "tasks": {
    "task-001": {
      "state": "done",
      "assignedTo": "worker",
      "createdAt": "2026-02-28T14:00:00Z",
      "updatedAt": "2026-02-28T16:20:05Z",
      "reworkCount": 1,
      "sourceFile": "docs/tasks/task-001.md"
    },
    "task-002": {
      "state": "in_progress",
      "assignedTo": "worker",
      "createdAt": "2026-02-28T16:20:10Z",
      "updatedAt": "2026-02-28T16:20:15Z",
      "reworkCount": 0,
      "sourceFile": "docs/tasks/task-002.md"
    },
    "task-003": {
      "state": "pending",
      "assignedTo": null,
      "createdAt": "2026-02-28T16:20:10Z",
      "updatedAt": "2026-02-28T16:20:10Z",
      "reworkCount": 0,
      "sourceFile": "docs/tasks/task-003.md"
    }
  },
  "summary": {
    "total": 3,
    "done": 1,
    "in_progress": 1,
    "pending": 1,
    "failed": 0
  }
}
```

**상태 분포 빠른 확인:**

```bash
# 전체 상태 요약
cat .botspace/registry.json | python3 -c "import json,sys; r=json.load(sys.stdin); print(r.get('summary', {}))"

# 실패 태스크만 확인
cat .botspace/registry.json | python3 -c "
import json, sys
r = json.load(sys.stdin)
failed = {k: v for k, v in r['tasks'].items() if v['state'] == 'failed'}
print(json.dumps(failed, indent=2, ensure_ascii=False))
"
```

### 비용 추적 및 예산 설정 권장값

**시나리오별 권장 예산:**

| 시나리오 | 태스크 수 | maxTotalBudgetUsd | maxBudgetPerTaskUsd (coordinator) | maxBudgetPerTaskUsd (worker) |
|---------|---------|-------------------|----------------------------------|------------------------------|
| 소규모 개발팀 (5태스크) | ~5 | $15 | $3 | $8 |
| 중규모 개발팀 (20태스크) | ~20 | $50 | $5 | $10 |
| 리서치팀 (10 브리프) | ~10 | $30 | $4 | $8 |
| 데이터 파이프라인 | ~8 | $40 | $5 | $12 |

**비용 절감 팁:**
- coordinator와 reviewer는 Opus 대신 Sonnet으로도 운영 가능 (복잡도에 따라 조정)
- `maxTurnsPerTask`를 낮게 설정하면 토큰 낭비를 줄일 수 있음
- 새 워크플로우를 처음 시도할 때는 태스크 1~2개로 소규모 테스트 후 확장

**봇별 실제 비용 확인:**

```bash
cat .botspace/coordinator/sessions.json
cat .botspace/worker/sessions.json
cat .botspace/reviewer/sessions.json
```

### 자주 발생하는 문제 및 해결 방법

**문제 1: 봇이 메시지에 응답하지 않음**

원인: 인박스 파일의 메시지 형식이 parseTasks 정규식과 맞지 않음.

확인:
```bash
cat .botspace/inbox/worker.md
```

해결: 메시지가 정확히 `- [ ] MSG-NNN | from:... | to:... | subject:... | ...` 형식인지 확인. 파이프(`|`) 양쪽 공백, 대소문자 확인.

---

**문제 2: registry.json 쓰기 충돌**

원인: 여러 봇이 동시에 registry.json 쓰기 시도.

확인:
```bash
ls .botspace/.registry.lock
```

해결: lock 파일이 오래된 경우(봇 비정상 종료 등) 수동 삭제:
```bash
rm .botspace/.registry.lock
```

---

**문제 3: 태스크가 `failed` 상태로 전환됨**

원인: `maxRoutingCycles`(기본 3회)를 초과하여 rework가 반복됨.

확인:
```bash
cat .botspace/reviewer/task-NNN-r3.md  # 마지막 피드백 확인
```

해결:
1. 시스템 프롬프트를 검토하여 봇의 기준을 조정
2. 태스크 파일의 요구사항을 더 명확하게 작성
3. registry에서 수동으로 상태를 `pending`으로 리셋 후 재시도

---

**문제 4: 봇이 허용되지 않은 봇에게 메시지를 보내려 함**

원인: 시스템 프롬프트의 canContact 설명이 실제 config와 불일치.

확인: InboxManager가 board.md에 "Unauthorized contact attempt" 로그를 남김.
```bash
grep "Unauthorized" .botspace/board.md
```

해결: 시스템 프롬프트의 "연락 가능한 봇" 섹션을 `claudebot.swarm.json`의 `canContact` 배열과 동기화.

---

**문제 5: stuckTaskTimeoutMs 초과로 태스크 중단**

원인: 봇이 지나치게 복잡한 태스크를 처리하다 타임아웃.

해결:
1. `stuckTaskTimeoutMs` 값을 늘림 (기본 600000ms = 10분)
2. 또는 태스크를 더 작은 단위로 분리
3. `maxTurnsPerTask`를 늘려 봇에게 더 많은 사이클 허용

---

## 8. 고급 설정

### 멀티 엔트리봇 (병렬 워크스트림)

`entryBots`에 여러 봇을 지정하면 두 개 이상의 독립적인 워크스트림을 동시에 시작할 수 있습니다.

**예시: 프론트엔드팀 + 백엔드팀 동시 운영**

```json
{
  "swarmGraph": {
    "entryBots": ["fe-coordinator", "be-coordinator"],

    "bots": {
      "fe-coordinator": {
        "model": "claude-opus-4-6",
        "systemPromptFile": "prompts/fe-coordinator.md",
        "watchesFiles": ["docs/tasks/frontend/*.md"],
        "canContact": ["fe-worker", "fe-reviewer"],
        "workspaceDir": "fe-coordinator",
        "maxBudgetPerTaskUsd": 4.00,
        "maxTurnsPerTask": 25,
        "terminatesOnEmpty": true,
        "allowedTools": ["Read", "Write", "Edit", "Grep", "Glob"]
      },
      "be-coordinator": {
        "model": "claude-opus-4-6",
        "systemPromptFile": "prompts/be-coordinator.md",
        "watchesFiles": ["docs/tasks/backend/*.md"],
        "canContact": ["be-worker", "be-reviewer"],
        "workspaceDir": "be-coordinator",
        "maxBudgetPerTaskUsd": 4.00,
        "maxTurnsPerTask": 25,
        "terminatesOnEmpty": true,
        "allowedTools": ["Read", "Write", "Edit", "Grep", "Glob"]
      },
      "fe-worker": {
        "model": "claude-sonnet-4-6",
        "systemPromptFile": "prompts/fe-worker.md",
        "watchesFiles": [],
        "canContact": ["fe-coordinator", "fe-reviewer"],
        "workspaceDir": "fe-worker",
        "maxBudgetPerTaskUsd": 10.00,
        "maxTurnsPerTask": 60,
        "terminatesOnEmpty": false,
        "allowedTools": ["Read", "Write", "Edit", "Grep", "Glob", "Bash"]
      },
      "be-worker": {
        "model": "claude-sonnet-4-6",
        "systemPromptFile": "prompts/be-worker.md",
        "watchesFiles": [],
        "canContact": ["be-coordinator", "be-reviewer"],
        "workspaceDir": "be-worker",
        "maxBudgetPerTaskUsd": 10.00,
        "maxTurnsPerTask": 60,
        "terminatesOnEmpty": false,
        "allowedTools": ["Read", "Write", "Edit", "Grep", "Glob", "Bash"]
      },
      "fe-reviewer": {
        "model": "claude-sonnet-4-6",
        "systemPromptFile": "prompts/fe-reviewer.md",
        "watchesFiles": [],
        "canContact": ["fe-coordinator", "fe-worker"],
        "workspaceDir": "fe-reviewer",
        "maxBudgetPerTaskUsd": 3.00,
        "maxTurnsPerTask": 20,
        "terminatesOnEmpty": false,
        "allowedTools": ["Read", "Grep", "Glob", "Bash"]
      },
      "be-reviewer": {
        "model": "claude-sonnet-4-6",
        "systemPromptFile": "prompts/be-reviewer.md",
        "watchesFiles": [],
        "canContact": ["be-coordinator", "be-worker"],
        "workspaceDir": "be-reviewer",
        "maxBudgetPerTaskUsd": 3.00,
        "maxTurnsPerTask": 20,
        "terminatesOnEmpty": false,
        "allowedTools": ["Read", "Grep", "Glob", "Bash"]
      }
    }
  }
}
```

주의: 멀티 엔트리봇 구성에서 두 워크스트림이 같은 파일을 동시에 수정하면 충돌이 발생합니다. `watchesFiles` 글로브 패턴이 겹치지 않도록 구성하십시오.

### maxRoutingCycles 조정 기준

`maxRoutingCycles`는 하나의 태스크가 rework를 거칠 수 있는 최대 횟수입니다. 이 값을 초과하면 태스크는 `failed`로 처리됩니다.

| 상황 | 권장값 | 이유 |
|------|--------|------|
| 단순 구현 태스크 | 2 | 2번 이상 실패하면 태스크 재정의 필요 |
| 복잡한 구현 태스크 | 3 (기본값) | 복잡성으로 인한 여러 번 반복 허용 |
| 창작/리서치 태스크 | 2 | 주관적 기준, 과도한 반복은 무의미 |
| 데이터 파이프라인 | 4 | 데이터 품질 기준이 엄격할 경우 |

**조정 방법:**

```json
"message": {
  "routingStrategy": "explicit",
  "format": "envelope",
  "maxRoutingCycles": 4
}
```

### stuckTaskTimeoutMs 설정 가이드

`stuckTaskTimeoutMs`는 하나의 태스크 처리가 이 시간을 초과하면 stuck으로 간주하고 failed 처리하는 타임아웃입니다.

| 태스크 유형 | 권장값 | 밀리초 |
|------------|--------|--------|
| 단순 텍스트 편집 | 5분 | 300,000 |
| 소규모 코드 구현 | 10분 (기본값) | 600,000 |
| 대규모 코드 구현 | 20분 | 1,200,000 |
| 데이터 파이프라인 실행 | 30분 | 1,800,000 |
| 대규모 리서치 | 15분 | 900,000 |

**조정 방법:**

```json
"swarmGraph": {
  "stuckTaskTimeoutMs": 1200000,
  ...
}
```

### 봇별 모델 선택 기준

| 역할 | 권장 모델 | 이유 |
|------|-----------|------|
| 오케스트레이터 (coordinator, lead, planner) | `claude-opus-4-6` | 복잡한 계획 수립, 우선순위 판단, 전체 흐름 관리에 Opus의 추론 능력 필요 |
| 개발자/작성자 (worker, coder, writer, researcher) | `claude-sonnet-4-6` | 실제 구현 및 작성 작업에서 Sonnet이 속도와 품질의 균형 제공 |
| 리뷰어/검수 (reviewer, editor, tester) | `claude-sonnet-4-6` | 검증 작업은 창의성보다 정확성이 중요, Sonnet으로 충분 |
| 단순 반복 작업 봇 | `claude-haiku-3-5` | 포맷 변환, 단순 분류 등 기계적 작업에 비용 절감 |

**비용 최적화 전략:**

오케스트레이터도 비용을 줄이고 싶다면 Sonnet으로 변경 가능하나, 복잡한 태스크 분해나 예외 처리의 품질이 저하될 수 있습니다. 처음에는 Opus로 시작하고, 워크플로우가 안정화되면 Sonnet으로 다운그레이드하면서 품질을 비교하는 것을 권장합니다.

**모델 변경 방법:**

```json
"bots": {
  "coordinator": {
    "model": "claude-sonnet-4-6",  // Opus에서 Sonnet으로 변경
    ...
  }
}
```

---

## 참고 자료

- [PRD Section 10: BotGraph](./PRD.md#10-botgraph--generalized-multi-bot-collaborative-pipeline) — 설계 명세
- [ClaudeBot 기술 스펙](./TechSpec.md) — 구현 세부사항
- [Claude Agent SDK 문서](https://docs.anthropic.com/claude-agent-sdk) — 기반 SDK
