# ClaudeBot 개선 로드맵 (Phase 3~5)

> 버전: 0.2.0 — 최종 업데이트: 2026-03-01
> 상태: 제안 (Proposal) — Phase 2 BotGraph 완성 후 구현 시작
> 선행 조건: PRD.md Section 10 (BotGraph) 구현 완료

---

## 1. 비전 및 동기

### 1.1 해결하려는 문제

현재 ClaudeBot은 단일 봇이 마크다운 작업 큐를 순차 실행하는 CLI 도구다. BotGraph(Phase 2)가 완성되면 N개 봇의 정적 협업이 가능해지지만, 다음 과제가 남는다:

1. **관찰성 부재**: N개 봇의 실시간 상태를 터미널 로그로만 확인할 수 있어 병목 지점 파악이 어렵다.
2. **정적 구성의 한계**: 모든 봇 역할과 연결을 실행 전 `claudebot.swarm.json`에 선언해야 한다. 프로젝트 특성에 맞는 최적의 봇 구성을 사용자가 직접 설계해야 하는 부담이 있다.
3. **온보딩 부재**: "한 줄 프롬프트 → 즉시 실행" 방식은 복잡한 프로젝트에서 목표 표류(goal drift)를 유발한다.

### 1.2 비전

> "목표만 말하면, 팀이 스스로 구성되고, 일하고, 보고한다."

사용자가 프로젝트 목표를 설명하면 AI가 최적의 봇 팀을 구성하고, Dashboard를 통해 진행 상황을 실시간 모니터링하며, 완료 시 시각화된 결과 보고서를 받는다.

### 1.3 경쟁 차별점

| 경쟁 도구 | 접근 방식 | ClaudeBot 차별점 |
|-----------|----------|-----------------|
| CrewAI | Python 기반, YAML 선언 | TypeScript/Node.js 네이티브, 마크다운 기반 |
| AutoGen | Python, 복잡한 API | 파일 기반 통신, 외부 인프라(Redis 등) 불필요 |
| MetaGPT | 고정 SOP 역할 체계 | 동적 봇 생성 + 사용자 승인 HITL 워크플로우 |
| Cursor/Windsurf | IDE 통합형 | 독립 실행형 CLI, 하이브리드 엔진(SDK/CLI) |
| Devin | 단일 에이전트 루프 | 멀티 에이전트 파이프라인, 투명한 파일 기반 감사 추적 |

**ClaudeBot만의 고유 강점:**
- **제로 인프라**: Redis, RabbitMQ 없이 파일 I/O만으로 봇 간 통신
- **하이브리드 엔진**: API Key(SDK) 또는 Max 구독(CLI) 선택 가능
- **체계적 온보딩**: 한 줄 입력이 아닌 브레인스토밍 기반 목표 설정
- **PoC 통합**: 기술 검증을 개발 전에 자동화

---

## 2. 대상 사용자 (페르소나)

| 페르소나 | 설명 | 핵심 니즈 | 주요 사용 기능 |
|----------|------|----------|---------------|
| **솔로 개발자** | 개인 프로젝트에서 반복 작업 자동화를 원하는 개발자 | 간단한 CLI, 저비용 | Phase 1 작업 큐, TUI 모니터링 |
| **테크 리더** | 팀의 야간 자동화 파이프라인을 관리하는 리드 | 실시간 모니터링, 비용 관리 | Dashboard, 비용 대시보드 |
| **AI 파워 유저** | 복잡한 멀티봇 워크플로우를 설계하고 실행하는 개발자 | 동적 봇 구성, 자동 온보딩 | Orchestrator, 3-Step Workflow |

---

## 3. Phase 구조

```
Phase 1 (완료): 단일 봇 순차 작업 큐 실행
Phase 2 (계획, PRD Section 10): BotGraph — 정적 config 기반 N봇 협업
Phase 3: Dashboard v1 — 봇 상태 모니터링 (읽기 전용)
Phase 4: Orchestrator — 동적 봇 생성 + 3-Step Workflow
Phase 5: Dashboard v2 — 대화형 인터페이스 + 결과 보고서
```

> Phase 2(BotGraph)가 이 문서의 모든 기능의 인프라 기반이다. BotGraph의 `SwarmOrchestrator`, `InboxManager`, `RegistryManager`가 안정적으로 동작해야 Phase 3 이후 진행이 가능하다.

---

## 4. Phase 3: Dashboard v1 (봇 모니터링)

### 4.1 사용자 스토리

- "개발자로서, 3개의 봇이 병렬 작업 중일 때 각 봇의 진행 상태를 한 화면에서 실시간으로 확인하고 싶다."
- "테크 리더로서, 야간 자동 실행 중인 봇들의 총 비용과 남은 예산을 확인하고 싶다."
- "개발자로서, 특정 봇에서 에러가 발생했을 때 해당 봇의 로그와 컨텍스트를 즉시 확인하고 싶다."

### 4.2 기술 전략: 하이브리드 (TUI 우선 → Web UI 확장)

| 단계 | 기술 | 적합한 시점 |
|------|------|------------|
| **v1 TUI** | `ink` (React for Terminal) | BotGraph 안정화 직후 |
| **v2 Web** | React + Vite + WebSocket | N봇 확장, 원격 모니터링 필요 시 |

> Electron은 번들 크기(150MB+) 대비 이점이 없어 권장하지 않음. `blessed`는 유지보수 중단 상태로 `ink`를 권장.

**구현 아키텍처:**

```
ClaudeBot Process
  +-- SwarmOrchestrator (BotGraph 기존)
  +-- EventBus (신규 - EventEmitter 기반)
  │     +-- bot:status 이벤트
  │     +-- message:new 이벤트
  │     +-- task:update 이벤트
  │     +-- log:entry 이벤트
  │     +-- cost:update 이벤트
  +-- DashboardServer (신규 - v2에서 추가)
        +-- Express/Fastify (HTTP, 정적 파일)
        +-- WebSocket Server (실시간 스트리밍)
```

### 4.3 레이아웃 설계

#### 메인 Dashboard (Desktop, 1440px+)

```
+==============================================================================+
| [ClaudeBot]  Project: my-app  |  Tasks: 12/20  |  Cost: $3.42/$50  |  [Gear]|
|  Bots: 3 active / 5 total    |  Queue: 4 msgs |  Uptime: 2h 14m   |        |
+==============================================================================+
|          |                                           |                       |
| BOT LIST |  CONVERSATION TIMELINE                    |  CONTEXT PANEL        |
| ======== |  ======================                   |  =============        |
|          |                                           |  [Tabs]               |
| [Queue:4]|  +-- Thread: task-001 (JWT Auth) ------+  |  [Detail|Log|Queue]   |
| ________ |  | [Orch] 14:00                         |  |                       |
|          |  | worker에게 JWT 인증 구현을            |  |  Bot: worker          |
| WORKING  |  | 위임합니다.                           |  |  Status: WORKING      |
| +------+ |  |                                      |  |  Task: task-001       |
| |worker| |  | [Worker] 14:22                       |  |  Model: sonnet        |
| |task-  | |  | RS256 vs HS256 어떤 것을             |  |  Cost: $1.23          |
| |001   | |  | 사용할까요?                           |  |  Turns: 12/60         |
| |$1.23 | |  |                                      |  |                       |
| +------+ |  | [!] DECISION REQUIRED      [Urgent] |  |  --- Session Log ---  |
|          |  | +----------------------------------+ |  |  14:00 Task assigned  |
| WAITING  |  | | JWT 암호화 방식을 결정해           | |  |  14:01 Reading specs  |
| +------+ |  | | 주세요.                            | |  |  14:15 Impl started   |
| |review| |  | |                                   | |  |  14:22 Question sent  |
| |idle  | |  | | [RS256] [HS256] [More Info]       | |  |                       |
| +------+ |  | +----------------------------------+ |  | ===================== |
|          |  |                                      |  |  --- Orch Decisions --|
| DONE (2) |  | [Orch] 14:23                         |  |  [CRIT] Budget 70%   |
| task-000 |  | RS256을 사용하세요.                   |  |  [WARN] Worker slow   |
| task-003 |  +--------------------------------------+  |  [INFO] QA assigned   |
|          |                                           |                       |
+==========+===========================================+=======================+
|  [Filter: All Bots v]  [Search conversations...]                             |
|  +----------------------------------------------------------------------+    |
|  | @Orchestrator 메시지를 입력하세요...                   [Send][Ctrl+Enter] |
|  +----------------------------------------------------------------------+    |
+==============================================================================+
```

#### 핵심 설계 원칙

| 요소 | 설계 결정 | 근거 |
|------|----------|------|
| **글로벌 상태 바** | 최상단 고정, 항상 표시 | 어떤 패널에 포커스가 있든 전체 상태 즉시 파악 |
| **봇 목록** | 상태별 그룹핑 (WORKING > WAITING > ERROR > DONE) | 단순 나열 시 N봇 확장에서 과밀 |
| **대화 타임라인** | Task별 Thread 그룹핑, 접힘/펼침 | 시간순 나열은 N봇에서 정보 과부하 유발 |
| **컨텍스트 패널** | Detail/Log/Queue 탭 분리 | 상/하 분할 시 공간 경쟁 문제 |
| **의사결정 요청** | 인라인 Decision Card | 대화 맥락 유지하면서 행동 유도 |

#### Compact 모니터링 뷰 (장시간 자동 실행용)

```
+==========================================+
| ClaudeBot | 12/20 | $3.42 | 3 bots | Q:4|
|------------------------------------------|
| [!] Decision: JWT 암호화 방식 결정       |
| worker: JWT auth 구현 중... (70%)        |
| reviewer: 대기 중                        |
| coordinator: 모니터링 중                 |
+==========================================+
```

### 4.4 메시지 큐

| 요소 | 설계 |
|------|------|
| 우선순위 | 사용자 메시지 > 봇 메시지 (인메모리 `MinHeap` 큐) |
| 영속성 | 인메모리 큐 + 파일 inbox 이중 계층 (재시작 후 복구용) |
| 시각화 | Dashboard 좌측 상단에 큐 깊이 표시, Queue 탭에서 편집/삭제 |
| 인터랙션 | 큐잉된 메시지 클릭 → 상세 표시, 우선순위 변경/삭제 가능 |

### 4.5 UX 요구사항

| 범주 | 요구사항 |
|------|---------|
| **접근성** | WCAG 2.1 AA 준수, 색상 + 아이콘 병용 (색각 이상 대응), 키보드 네비게이션, ARIA 라벨 |
| **다크 모드** | CSS custom properties 기반 테마, 기본값 다크 (개발자 도구 관례) |
| **키보드 단축키** | `Ctrl+K` 커맨드 팔레트, `Ctrl+1/2/3` 패널 전환, `J/K` 항목 이동, `Ctrl+Enter` 전송 |
| **검색/필터** | 대화 키워드 검색, 봇별/중요도별/시간대별 필터, 로그 필터 |
| **반응형** | 1440px+ 풀 레이아웃 → 1024px 좌측 축소 → 768px 탭 전환 |
| **알림** | Critical: 모달+사운드, Important: 토스트+배지, Info: 로그 영역, Debug: 상세 뷰에서만 |
| **자동 스크롤** | 새 메시지 시 자동 스크롤, 과거 메시지 읽는 중이면 "N개의 새 메시지" 버튼 |
| **비활성 탭** | 브라우저 탭 제목에 알림 카운터 표시 (예: "(3) ClaudeBot") |

### 4.6 오류 상태 UI

| 오류 시나리오 | UI 표현 | 사용자 안내 |
|--------------|---------|------------|
| 봇 프로세스 크래시 | 봇 카드 빨간 강조 + 에러 배지 | "worker가 비정상 종료됨. 재시작 또는 작업 재할당 필요" |
| API 예산 초과 | 글로벌 바 경고 배너 | "예산 한도($50) 도달. 추가 예산 설정 또는 작업 중단" |
| 파일 락 충돌 | 로그에 경고 + 자동 재시도 | "registry.json 락 충돌 감지. 5초 후 자동 재시도" |
| 메시지 라우팅 실패 | 대화에 인라인 경고 | "worker→reviewer 메시지 거부됨: canContact 위반" |
| 봇 데드락 | 글로벌 바 경고 + 상세 로그 | "worker↔reviewer 상호 대기 감지. 작업 강제 실패 처리 권장" |
| 도메인 이탈 감지 | 인라인 Decision Card | "worker가 목표에서 벗어남. 원인 조사 결과: [세부사항]. 계속/중단?" |

### 4.7 성공 지표

| 지표 | 목표 |
|------|------|
| 봇 상태 확인 소요 시간 | 터미널 로그 대비 80% 단축 |
| 에러 감지~대응 시간 | 5분 이내 |
| Dashboard 안정성 | N=10 봇 동시 모니터링 시 프레임 드롭 없음 |

---

## 5. Phase 4: Orchestrator (동적 봇 생성)

> BotGraph의 정적 config 방식을 대체하는 것이 아니라, BotGraph 위에 구축되는 AI 레이어다. 내부적으로 BotGraph API를 호출하여 봇을 동적으로 생성/관리한다.

### 5.1 사용자 스토리

- "개발자로서, '로그인 기능 구현'이라는 목표만 제시하면 필요한 봇 구성(프론트엔드 봇, 백엔드 봇, QA 봇)이 자동으로 제안되길 원한다."
- "개발자로서, PoC가 필요한 기술적 난이도 높은 작업의 경우 본 개발 전에 기술 검증이 완료되었다는 확신을 가지고 싶다."
- "테크 리더로서, 봇이 목표에서 벗어나면 즉시 알림을 받고 작업을 중단시킬 수 있어야 한다."

### 5.2 Orchestrator 봇 (기존 Bot-PD 개념 통합)

> 용어 표준화: "Bot-PD" → **"Orchestrator"** (글로벌 사용자 대상으로 보편적 용어 채택)

| 속성 | 설계 |
|------|------|
| 역할 | BotGraph의 `entryBot` + 동적 봇 생성 권한을 가진 특수 봇 |
| 사용자 인터페이스 | 사용자와 대화하는 유일한 봇 |
| BotGraph 관계 | `claudebot.swarm.json`의 특수 봇 타입 (`"type": "orchestrator"`) |
| 구현 방식 | `SwarmOrchestrator`에 `addBot(name, definition)` 런타임 API를 추가하여 동적 생성 |

#### Orchestrator의 폴링 우선순위

```
1. 사용자 메시지 읽기 (최우선)
2. 대기 중인 작업 순차 처리
3. Sub-Bot 상태 확인 및 모니터링
```

> **아키텍처 주의사항**: 폴링 루프 안에서 Claude 호출이 수십 초~수분 걸릴 수 있으므로, 사용자 메시지 우선 처리를 위해 비동기 이벤트 루프(`EventEmitter` + 우선순위 큐)와 Claude 호출을 분리해야 한다.

#### Orchestrator와 Sub-Bot 관계

| 항목 | 설계 |
|------|------|
| Sub-Bot 생성 | Orchestrator가 BotGraph의 `addBot()` API를 호출하여 런타임에 생성 |
| Sub-Bot 권한 | **최소 권한 원칙** 적용 — 역할에 필요한 도구만 허용 (모든 권한 부여 금지) |
| Sub-Bot 수 제한 | config에서 `maxConcurrentBots` 설정 (기본값: 5, 연구에 따르면 6개 이상은 성능 저하) |
| Sub-Bot 생명주기 | 생성 → 작업 할당 → 완료/실패 → 종료 (자동 정리) |
| Sub-Bot 간 통신 | BotGraph의 `canContact` 화이트리스트 적용 — Orchestrator가 동적으로 설정 |
| 의사결정 기록 | 모든 봇 생성/삭제/역할 변경을 `board.md`에 기록 |

#### Sub-Bot 생성 프로토콜

```typescript
// Orchestrator의 LLM 출력에서 봇 생성 의도를 구조화된 JSON으로 반환
interface BotProposal {
  name: string;                    // 예: "frontend-dev"
  role: string;                    // 예: "React 컴포넌트 개발"
  model: 'sonnet' | 'opus' | 'haiku';
  allowedTools: string[];          // 최소 권한
  canContact: string[];            // 통신 가능 대상
  maxBudgetPerTaskUsd: number;
  justification: string;          // 생성 근거 (사용자 승인 시 표시)
}
```

### 5.3 3-Step Workflow

#### Step 1: 목표 설정 온보딩

> 업계에서 거의 유일한 체계적 접근. "한 줄 입력 → 즉시 실행"이 주류인 경쟁 환경에서 차별화 포인트.

```
[사용자] → 프로젝트 목표 설명
              ↓
[Orchestrator] → 대화 기반 브레인스토밍
              ↓
         목표 명확화 + 요구사항 정리
              ↓
         기술 난이도 평가
              ↓
    ┌─────────┴─────────┐
    │                    │
  난이도 낮음         난이도 높음
    │                    │
    ↓                    ↓
  문서 생성          PoC 제안 → PoC 실행
    │                    │
    ↓                    ↓
  PRD-topic.md       PoC 결과 → TechSpec 반영
  TechSpec-topic.md      │
  Task-topic.md          ↓
    │              사용자에게 시작 알림
    ↓
  사용자 최종 승인
```

**온보딩 산출물:**
- `PRD-{topic}.md` — 프로젝트 요구사항
- `TechSpec-{topic}.md` — 기술 명세 (PoC 결과 포함)
- `Task-{topic}.md` — 실행할 작업 목록 (마크다운 체크박스)

**PoC 프로세스:**
- PoC는 무조건 구현이 아니라, 자료 수집 + 기술 타당성 검토가 병행되어야 한다
- PoC용 전담 Sub-Bot을 구성하여 진행
- 모든 PoC 결과가 명확해지면 TechSpec에 정리 후 사용자에게 알림
- 활용 가능한 도구: sub agent, context7 MCP, playwright MCP 등

#### Step 2: Sub-Bot 제안 및 승인

```
[Orchestrator] → Task-topic.md 분석
              ↓
         역할별 봇 구성 제안
         (각 봇의 이름, 역할, 모델, 도구, 예산, 근거)
              ↓
[Dashboard] → 제안 카드 표시
              ↓
[사용자] → 승인/수정/거부
              ↓
[Orchestrator] → BotGraph addBot() API로 봇 생성
```

**제안 형식 (Decision Card):**

```
+----------------------------------------------------------+
|  Bot Team Proposal                          [Review]      |
|                                                           |
|  목표: JWT 인증 시스템 구현                               |
|                                                           |
|  제안된 팀:                                               |
|  1. backend-dev (Sonnet) — JWT 인증 로직 구현            |
|     도구: Read, Write, Edit, Bash, Grep, Glob            |
|     예산: $5.00 / 작업                                    |
|                                                           |
|  2. frontend-dev (Sonnet) — 로그인 UI 구현               |
|     도구: Read, Write, Edit, Bash, Grep, Glob            |
|     예산: $5.00 / 작업                                    |
|                                                           |
|  3. qa-tester (Sonnet) — 통합 테스트 검증                |
|     도구: Read, Bash, Grep, Glob (읽기 전용)             |
|     예산: $3.00 / 작업                                    |
|                                                           |
|  총 예상 비용: $13.00~$20.00                              |
|  예상 소요: 15~20 turns                                   |
|                                                           |
|  [승인] [수정] [거부]                                     |
+----------------------------------------------------------+
```

#### Step 3: 작업 진행

```
개발 ──► 검증 ──► 안정성 확인 ──► 완료
  ↑         │
  └─ REWORK ┘  (최대 maxRoutingCycles 반복)
```

**작업 진행 규칙:**

| 규칙 | 설명 |
|------|------|
| 병렬 탐지 | Orchestrator가 수시로 병렬 가능 작업을 식별하여 Sub-Bot 투입 |
| 도메인 이탈 감지 | 목표에서 벗어난 작업 발견 시 즉시 사용자 알림, 해당 Sub-Bot에 원인 조회, 필요시 작업 중단 |
| 작업 완료 판단 | Task-topic.md의 모든 체크박스 완료 시 Orchestrator가 메인 채팅에 알림 |
| 연속 작업 | Task-topic.md 검토 후 다음 작업 자동 진행 |
| 작업 추가 | 진행 중 필요 발견 시 Orchestrator가 주도적으로 Task-topic.md에 작업 추가 |

### 5.4 BotGraph와의 관계 (아키텍처 설계)

> Orchestrator는 BotGraph를 **대체하지 않고 확장**한다.

```
사용자
  ↓ (대화)
Orchestrator (특수 entryBot)
  ↓ (BotGraph API 호출)
SwarmOrchestrator.addBot(name, definition)
  ↓ (기존 BotGraph 인프라)
ClaudeBot 인스턴스 생성
  ↓
파일 기반 inbox/board 통신
```

**BotGraph 확장이 필요한 지점:**

| 컴포넌트 | 현재 (정적) | 확장 (동적) |
|----------|-----------|-----------|
| `SwarmOrchestrator` | 시작 시 N개 일괄 생성 | `addBot()` / `removeBot()` 런타임 API |
| `InboxManager` | 시작 시 inbox 일괄 생성 | 봇 추가 시 동적 등록 |
| `canContact` | 불변 화이트리스트 | 동적 확장 가능 |
| `parseTasks()` | 순서대로 처리 | 우선순위 정렬 지원 |
| `EventBus` | 없음 | `onBotCreated`, `onBotCompleted`, `onCostUpdate` 이벤트 |

**정적 BotGraph의 유지 이유:**
- 고급 사용자는 직접 `claudebot.swarm.json`을 작성하여 봇 구성을 완전히 제어하고 싶어할 수 있다
- Orchestrator의 자동 제안이 마음에 들지 않을 경우 수동 config 작성 가능
- 두 방식은 상호 보완적: Orchestrator는 내부적으로 BotGraph의 config 형식을 생성

### 5.5 성공 지표

| 지표 | 목표 |
|------|------|
| 수동 config 작성 대비 봇 구성 시간 | 70% 절감 |
| 온보딩에서 실행 시작까지 | 평균 15분 이내 |
| Orchestrator 봇 제안 승인율 | 80% 이상 |
| 도메인 이탈 감지 정확도 | 90% 이상 |

---

## 6. Phase 5: Dashboard v2 (대화형 + 보고서)

### 6.1 사용자 스토리

- "개발자로서, Dashboard에서 Orchestrator와 직접 대화하여 작업을 지시하고 싶다."
- "테크 리더로서, 완료된 작업의 결과를 시각화된 HTML 보고서로 받아 팀에 공유하고 싶다."

### 6.2 대화형 인터페이스

- 메인 채팅창에서 Orchestrator와 사용자만 입력 가능
- Sub-Bot 간 대화는 별도 "Internal Channel" 탭에 표시
- 사용자에게 영향을 주는 결정만 메인 채팅에 서피스
- 긴급 시 `@mention` 패턴으로 Sub-Bot 직접 제어 가능 (Override 메커니즘)

### 6.3 작업 결과 보고서

| 항목 | 내용 |
|------|------|
| 형식 | HTML (다양한 시각화 포함) |
| 내용 | 완료 작업 목록, 작업별 소요 시간/비용, 봇별 기여도, 생성/수정된 파일 목록, QA 검증 결과, 총 비용 요약 |
| 추가 기능 | Git diff 통합 뷰, 비용 대비 성과 시각화, PDF 다운로드, 재작업(REWORK) 비율 |
| 생성 주체 | Orchestrator가 작업 완료 시 자동 생성 |

### 6.4 성공 지표

| 지표 | 목표 |
|------|------|
| 대화형 인터페이스 응답 지연 | 2초 이내 |
| 결과 보고서 사용자 만족도 | NPS 40+ |

---

## 7. 비용 관리 체계 (전 Phase 공통)

> 멀티에이전트 시스템에서 비용 관리는 성패를 가르는 핵심 요소다. 연구에 따르면 에이전틱 AI 프로젝트의 40% 이상이 비용 문제로 프로덕션 전에 실패한다.

### 7.1 비용 추적 계층

| 계층 | 추적 항목 | 현재 지원 | 추가 필요 |
|------|----------|----------|----------|
| 전역 | 총 비용, 남은 예산 | `CostTracker` ✅ | 실시간 Dashboard 표시 |
| 봇별 | 봇당 누적 비용 | `SessionManager` (부분) | 봇 ID별 비용 귀속 |
| 작업별 | 작업당 비용 | `TaskResult.costUsd` ✅ | 작업 유형별 평균 비용 |
| 토큰별 | 입력/출력 토큰 수 | `CostSummary` (placeholder) | 실시간 토큰 모니터링 |

### 7.2 비용 제어 정책

| 정책 | 설명 | config 필드 |
|------|------|------------|
| 전역 예산 한도 | 전체 실행의 USD 상한 | `maxTotalBudgetUsd` (기존) |
| 봇당 예산 한도 | 개별 봇의 USD 상한 | `maxBudgetPerTaskUsd` (기존) |
| 동시 봇 수 제한 | Orchestrator가 생성 가능한 최대 봇 수 | `maxConcurrentBots` (신규, 기본: 5) |
| 비용 경고 임계값 | 예산 70%/90% 도달 시 알림 | `costAlertThresholds` (신규) |
| 지능형 모델 라우팅 | 간단한 작업은 Haiku, 복잡한 추론은 Opus | `modelRouting: 'auto'` (신규) |

### 7.3 비용 시각화 (Dashboard)

- 글로벌 바에 실시간 비용 표시: `$3.42 / $50.00`
- 봇별 비용 분포 차트
- 시간대별 비용 추이 그래프
- 예산 70%/90% 도달 시 시각적 경고

---

## 8. 관측성 (Observability)

### 8.1 트레이싱

| 수준 | 내용 | 구현 방식 |
|------|------|----------|
| 봇 상태 | idle / working / waiting / error | `registry.json` 기반 |
| 작업 진행 | pending → assigned → in_progress → reviewing → done/failed | BotGraph 상태 머신 |
| LLM 호출 | 프롬프트, 응답 요약, 토큰 수, 지연시간 | EventBus 이벤트 |
| 도구 사용 | 어떤 도구를 얼마나 사용했는지 | SDK 메시지 스트림에서 추출 |

### 8.2 운영 메트릭

| 메트릭 | 설명 |
|--------|------|
| P50/P99 작업 완료 시간 | 작업별 지연 분포 |
| 에러율 | 전체 작업 대비 실패 비율 |
| REWORK 비율 | QA 실패로 인한 재작업 비율 |
| 봇 활용률 | 봇의 활성 시간 대비 대기 시간 |

---

## 9. 보안 고려사항

| 항목 | 정책 |
|------|------|
| Sub-Bot 도구 권한 | 최소 권한 원칙 — 역할에 필요한 도구만 허용 |
| QA/Reviewer 봇 | Write/Edit 도구 금지 (읽기 전용) |
| Dashboard 접근 | 로컬 실행 시 `localhost` 바인딩, 원격 시 인증 토큰 필요 |
| 파일 접근 범위 | 봇별 `cwd` 설정으로 작업 디렉토리 제한 |
| 비밀 정보 | `.env`, 인증 정보 파일은 봇의 `allowedTools`에서 제외 |

---

## 10. 위험 평가

| 위험 | 심각도 | 발생 가능성 | 대응 방안 |
|------|--------|-----------|----------|
| Orchestrator가 불필요한 봇 과다 생성 → 비용 폭주 | 높음 | 높음 | `maxConcurrentBots` 상한, 봇 생성 시 사용자 승인 필수 |
| Dashboard 개발로 핵심(CLI) 개발 지연 | 높음 | 매우 높음 | TUI v1부터 점진적 구현, Phase 분리 |
| 파일 기반 I/O 동시성 문제 (락 경합) | 중간 | 중간 | `.registry.lock` 센티넬 + 인메모리 큐 이중 계층 |
| Orchestrator 의사결정 품질 미달 | 높음 | 높음 | 사용자 승인 단계(HITL), 도메인 이탈 감지 |
| 3-Step 온보딩이 과도하게 복잡 → 사용자 이탈 | 중간 | 중간 | 간소화 모드 제공 (`--quick` 플래그로 온보딩 스킵) |
| LLM 기반 의사결정의 비결정성 → 동일 상황 다른 결과 | 중간 | 높음 | `maxRoutingCycles`, `maxConcurrentBots` 등 config 레벨 상한 강제 |

---

## 11. 용어 표준화

> 프로젝트 전체에서 일관된 용어를 사용한다.

| 역할 | 표준 용어 | 이전 용어 (deprecated) | 사용 위치 |
|------|----------|----------------------|----------|
| 동적 봇 생성 권한을 가진 진입 봇 | **Orchestrator** | Bot-PD, PD | Adv.md, config |
| 실행 역할을 수행하는 봇 | **Worker** | Sub-Bot, Developer | config, prompts |
| 검증/리뷰 역할의 읽기 전용 봇 | **Reviewer** | QA | config, prompts |
| BotGraph의 진입 봇 (정적) | **Entry Bot** | Coordinator, Manager | PRD, TechSpec |
| 사용자가 자유롭게 지정하는 봇 이름 | **도메인 이름** (자유) | — | `claudebot.swarm.json` |

---

## 12. 구현 로드맵

| Phase | 산출물 | 선행 조건 | 우선순위 |
|-------|--------|----------|---------|
| **2** (PRD 기존) | BotGraph 전체 (`src/swarm/` 8개 파일) | Phase 1 완료 ✅ | **최우선** |
| **3.1** | EventBus + TUI Dashboard v1 | Phase 2 완료 | 높음 |
| **3.2** | 비용 모니터링 패널 | Phase 3.1 | 높음 |
| **4.1** | Orchestrator 봇 타입 + `addBot()` API | Phase 2 완료 | 높음 |
| **4.2** | 3-Step Workflow (온보딩 → 제안 → 실행) | Phase 4.1 | 중간 |
| **4.3** | PoC 자동화 + 도메인 이탈 감지 | Phase 4.2 | 중간 |
| **5.1** | Web Dashboard v2 (React + WebSocket) | Phase 3.1 | 중간 |
| **5.2** | 대화형 인터페이스 (사용자-Orchestrator) | Phase 5.1 | 중간 |
| **5.3** | HTML 결과 보고서 생성기 | Phase 4.2 | 낮음 |
| **5.4** | 메신저 연동 (알림 시스템) | Phase 5.1 | 낮음 |

---

## 부록 A: 업계 비교 참조

### 동적 에이전트 생성 패턴

| 패턴 | 출처 | ClaudeBot 적용 |
|------|------|---------------|
| Arbiter Pattern | AWS Strands | Orchestrator의 역할 매칭 + 동적 생성 |
| MetaAgent | 위스콘신대학 연구 | 태스크 설명 → 에이전트 구성 자동 설계 |
| Factory Pattern | Microsoft ISE | `addBot()` API를 통한 런타임 생성 |
| Send API | LangGraph | 동적 워커 노드 생성 |

### 관측성 도구 참조

| 도구 | 유형 | 참고 기능 |
|------|------|----------|
| LangSmith | LLM 옵저빌리티 | 트레이스 트리, 비용 모니터링 |
| W&B Weave | AI 에이전트 추적 | 에이전트별 평가 스코어러 |
| Langfuse | 오픈소스 옵저빌리티 | 프롬프트 관리, 트레이싱 |

### HITL 패턴 참조

| 패턴 | 출처 | 참고 |
|------|------|------|
| `interrupt()` | LangGraph | 워크플로 중간 일시정지 → 인간 입력 → 재개 |
| `HumanTool` | CrewAI | 에이전트가 인간에게 안내 요청 |
| Signal 기반 | Temporal | UI에서 워크플로에 신호 주입 |
