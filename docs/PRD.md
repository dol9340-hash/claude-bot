# 제품 요구사항 문서 (PRD): ClaudeBot

## 1. 제품 비전

> "AI와 대화하며 개발을 위임하세요."

ClaudeBot은 **대화 기반 개발 오케스트레이터**입니다. 웹 Dashboard에서 ClaudeBot과 대화하면, ClaudeBot이 주도적으로 각 개발 Phase를 설계하고, 필요한 봇을 구성하여 개발을 진행합니다.

**핵심 가치:**

| 가치 | 설명 |
|------|------|
| **대화 중심** | CLI 명령어가 아닌, 자연어 대화로 개발 목표를 정의하고 실행 |
| **Phase 기반 워크플로우** | 온보딩 → 목표 예측 → 문서 작성 → 개발 진행 → 검토의 체계적 흐름 |
| **ClaudeBot 주도** | 각 Phase마다 ClaudeBot이 적절한 봇을 자동 구성하여 작업 수행 |
| **투명한 과정** | 모든 진행 상황이 Dashboard에서 실시간으로 가시화 |

---

## 2. 시작 Flow (Start Flow)

```
run.bat 실행
    │
    ▼
Dashboard 웹 UI 열기 (http://localhost:5173)
    │
    ▼
프로젝트 폴더 선택 (ProjectSelectPage)
    │
    ▼
서버 자동 분석 (WorkflowEngine.initializeProject)
    ├── AGENTS.md 읽기 (있으면)
    ├── docs/ 폴더 스캔 (최대 10개 .md 파일)
    └── claudebot.config.json 읽기
    │
    ▼
ClaudeBot 주도적 인사 메시지 전송
    ├── 발견한 문서 요약 표시
    ├── 설정 정보 표시
    └── "어떤 작업을 도와드릴까요?" 주도적 질문
    │
    ▼
Phase 1 (Onboarding) 자동 진입 → 사용자와 자유 대화
```

**핵심:** 사용자가 폴더만 선택하면 ClaudeBot이 먼저 말을 걸어 대화를 시작합니다.

---

## 3. 핵심 Flow

```
사용자 ←→ ClaudeBot (Web Dashboard)
              │
              ├── Phase 1: 온보딩 (Onboarding)
              │   ├── 프로젝트 파악, 자유 대화, 목표 설정
              │   └── Bot Team 제안 → 사용자 합의 (Decision Card)
              │
              ├── Phase 2: 목표 예측 (Goal Prediction)
              │   └── 코드베이스 분석, 예상 결과물 미리보기
              │
              ├── Phase 3: 문서 작성 (Documentation)
              │   └── PRD, TechSpec, Task 목록 자동 생성
              │
              ├── Phase 4: 개발 진행 (Development)
              │   └── ClaudeBot이 필요에 따라 봇 동적 생성 → 병렬 실행
              │
              └── Phase 5: 검토 (Review)
                  └── 결과 검증, 목표 달성도 확인, 보고서
```

---

## 4. Phase 상세

### Phase 1: 온보딩 (Onboarding)

**목적:** 사용자의 프로젝트와 목표를 이해하고, 작업에 필요한 Bot Team을 합의

**ClaudeBot의 역할:**
- 프로젝트 구조와 기존 코드 분석
- 질문을 통해 사용자의 의도 파악
- 기술 스택, 제약사항, 우선순위 확인
- **Bot Team 제안** — 목표 분석 후 필요한 봇 구성을 Decision Card로 제시

**Bot Team 제안 프로세스:**

```text
자유 대화로 목표 파악 완료
    │
    ▼
ClaudeBot이 Bot Team 제안 (Decision Card)
    ├── 각 봇의 역할과 필요 근거 명시
    │   예: "Reviewer Bot — Stripe 결제 로직의 보안 검증이 필수적이므로 포함"
    │   예: "Doc Writer Bot — API 명세와 Task 목록 자동화를 위해 포함"
    ├── 예상 비용/시간 포함
    └── 사용자 선택: 승인 / 수정 / 거절
         ├── 승인 → Phase 2로 전환
         ├── 수정 → 사용자 피드백 반영 후 재제안
         └── 거절 → 대화 계속, 목표 재정의
```

**전환 조건:** Bot Team 제안을 사용자가 승인 (Decision Card)

**입력:** 사용자의 자유 텍스트
**출력:** 합의된 Bot Team 구성 + 대화 컨텍스트

---

### Phase 2: 목표 예측 (Goal Prediction)

**목적:** 대화에서 수집한 정보로 개발 결과물을 미리 예상하고, HTML로 시각화하여 사용자가 직관적으로 확인

**ClaudeBot의 역할:**
- 온보딩 대화 분석
- 코드베이스 탐색 (필요시 Research Bot 생성)
- **HTML Output Preview** 생성 — 최종 결과물을 시각적으로 표현:
  - ① **최종 결과물 형태** — 예상 파일 구조, 컴포넌트 트리, 아키텍처 다이어그램
  - ② **사용자 관점 핵심 흐름** — UI 와이어프레임, 인터랙션 흐름, API 엔드포인트 맵
  - ③ **완료 기준** — 체크리스트, 예상 비용/시간, 기술 결정 사항

**Preview 형식:** 인라인 HTML (채팅 내 iframe 또는 별도 패널로 렌더링). 코드 블록이 아닌 시각적 HTML로 인지 부담 최소화.

**전환 조건:** 사용자가 HTML Output Preview를 승인 (Decision Card)

**입력:** Phase 1 대화 컨텍스트
**출력:** HTML Output Preview (승인됨)

---

### Phase 3: 문서 작성 (Documentation)

**목적:** 실행 가능한 개발 문서를 자동 생성

**ClaudeBot의 역할:**
- Doc Writer Bot을 생성하여 문서 작성
- 생성 문서:
  - `docs/PRD-{topic}.md` — 요구사항 정의
  - `docs/TechSpec-{topic}.md` — 기술 명세
  - `docs/Tasks-{topic}.md` — 실행 작업 목록 (체크박스)
- 기술 난이도가 높은 항목은 PoC 검증 포함
- **문서 미리보기:** 생성된 문서를 HTML로 시각화하여 채팅 내에서 탭 형태로 표시. 사용자는 채팅으로 피드백/승인

**전환 조건:** 사용자가 HTML 문서 미리보기를 확인하고 채팅으로 승인

**입력:** Phase 2 Output Preview
**출력:** 개발 문서 3종 (HTML 시각화 미리보기 포함)

---

### Phase 4: 개발 진행 (Development)

**목적:** 문서 기반으로 실제 코드 개발 수행

**ClaudeBot의 역할:**
- Phase 1에서 합의된 Bot Team을 기반으로 봇 생성 및 실행
- **동적 봇 생성** — 개발 도중 필요에 따라 ClaudeBot이 주도적으로 추가 봇 생성 (예: 테스트 필요 시 Tester Bot 추가, DB 마이그레이션 필요 시 전용 봇 생성)
- **병렬 실행** — 독립적인 Task는 여러 봇이 동시에 진행 (예: Developer Bot A가 API 구현 중 → Developer Bot B가 UI 컴포넌트 병렬 작업)
- Agent SDK를 통해 봇 실행
- 진행 상황을 Dashboard에 실시간 표시
- 목표 이탈(Goal Drift) 감지 시 사용자에게 알림

**전환 조건:** 모든 Task 완료 또는 사용자가 명시적으로 종료

**입력:** Tasks-{topic}.md
**출력:** 구현된 코드 + 실행 로그

---

### Phase 5: 검토 (Review)

**목적:** 개발 결과가 원래 목표대로 잘 되었는지 확인

**ClaudeBot의 역할:**
- Review Bot을 생성하여 결과 검증
- 목표 대비 달성도 체크
- 결과 보고서 생성:
  - 완료된 작업 목록
  - 비용/시간 요약
  - 코드 변경 사항
  - 미완료 항목 (있을 경우)
- 사용자에게 최종 확인 요청

**전환 조건:** 사용자가 최종 결과를 승인 (Decision Card)

**출력:** 결과 보고서 + 사용자 최종 승인

---

### Epic 사이클 (Epic Cycle)

**목적:** 하나의 Epic(주제)이 5-Phase를 완주하면, ClaudeBot이 자동으로 다음 개발 주제를 탐색하고 제시하여 연속적인 개발 사이클을 수행

**ClaudeBot의 역할:**

- Epic 완료 후 코드베이스 재분석 (TODO 주석, AGENTS.md, docs/ 문서 종합)
- 다음 Epic 후보 3개를 우선순위와 근거를 포함하여 사용자에게 제안 (Decision Card)
- 사용자 선택 또는 자동 선정 후 다음 5-Phase 사이클 시작

**온보딩 자동화 설정:**

```text
Epic 1 완료 (5-Phase 완주)

    │
    ▼
ClaudeBot: 코드베이스 재분석 → 다음 Epic 후보 탐색
    │
    ▼
다음 Epic 제안 (Decision Card)
    ├── 수동 모드 — 사용자가 직접 선택/승인
    └── 자동 모드 (Auto-Pilot) — ClaudeBot이 #1 후보 자동 선정
         │
         ▼
    다음 Epic 자동 시작 → Onboarding → Prediction → ... → Review
         │
         ▼
    반복 (예산 소진 또는 사용자 중단까지)
```

**자동 모드 (Auto-Pilot) 조건:**

- `claudebot.config.json`의 `autoOnboarding: true` 설정
- 잔여 예산이 다음 Epic 예상 비용 이상
- 사용자가 언제든 대화로 방향 수정 또는 중단 가능

**Config 스키마 (`claudebot.config.json`):**

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
| `model` | string | `"claude-sonnet-4-6"` | 봇 기본 모델 |

---

## 5. 시스템 아키텍처

### 단일 웹 앱 구조

```
┌─────────────────────────────────────────┐
│              Web Dashboard              │
│  ┌──────────────────────────────────┐   │
│  │     React SPA (Vite + TW)       │   │
│  │  ┌─────────┐  ┌──────────────┐  │   │
│  │  │ Sidebar │  │  ChatPage    │  │   │
│  │  │         │  │  (메인 UI)   │  │   │
│  │  └─────────┘  └──────────────┘  │   │
│  └──────────────────────────────────┘   │
│                                         │
│  ┌──────────────────────────────────┐   │
│  │     Fastify Server               │   │
│  │  ┌───────────┐ ┌─────────────┐  │   │
│  │  │ Chat API  │ │ WorkflowEng │  │   │
│  │  │ WebSocket │ │ (5-Phase)   │  │   │
│  │  └───────────┘ └─────────────┘  │   │
│  │  ┌───────────┐ ┌─────────────┐  │   │
│  │  │ SDK Exec  │ │ Bot Compose │  │   │
│  │  │ (Agent)   │ │ (동적 생성) │  │   │
│  │  └───────────┘ └─────────────┘  │   │
│  └──────────────────────────────────┘   │
└─────────────────────────────────────────┘
```

### 기술 스택

| 구성 요소 | 기술 |
|-----------|------|
| Frontend | React 19 + Vite + Tailwind CSS |
| Backend | Fastify 5 + WebSocket |
| AI Engine | `@anthropic-ai/claude-agent-sdk` |
| 실시간 통신 | WebSocket (채팅) + SSE (상태 업데이트) |
| 상태 저장 | JSON 파일 (`.claudebot/chat.json`) |
| 언어 | TypeScript (ESM) |

### 핵심 서비스

| 서비스 | 역할 |
|--------|------|
| **WorkflowEngine** | 5-Phase 상태 머신, Phase 전환 관리 |
| **ChatManager** | 메시지 저장, WebSocket 브로드캐스트, 메시지 큐 |
| **BotComposer** | Phase별 봇 동적 생성 (Agent SDK) |
| **ProjectAnalyzer** | 코드베이스 분석, 컨텍스트 수집 |

### 통신 모델 (Hub-Spoke)

```text
         사용자
          ↕
      ClaudeBot ← 중앙 허브, 모든 통신의 단일 접점
       ↕  ↕  ↕
  Bot A  Bot B  Bot C     ← 봇 간 직접 통신 없음
```

**원칙:**

- ClaudeBot이 모든 봇과 1:1로 대화하는 **허브-스포크** 구조
- **봇 간 직접 통신 금지** — Reviewer Bot의 피드백은 ClaudeBot을 거쳐 Developer Bot에 전달
- ClaudeBot이 전체 맥락을 유지하므로 목표 이탈 감지 및 우선순위 조정 가능

### 메시지 큐 (Message Queue)

여러 봇과 사용자의 메시지가 동시에 도착할 수 있으므로 ClaudeBot은 메시지 큐를 운영한다.

**우선순위:**

| 순위 | 메시지 유형 | 설명 |
| ---- | ----------- | ---- |
| 1 (최우선) | 사용자 메시지 | 항상 즉시 처리, 봇 응답보다 우선 |
| 2 | 봇 에러/중단 | 장애 상황은 빠르게 대응 |
| 3 | 봇 작업 완료 | 다음 Task 배정 판단 |
| 4 | 봇 진행 보고 | Dashboard 업데이트용, 지연 허용 |

**동작:** 사용자가 메시지를 보내면 현재 처리 중인 봇 응답은 큐에 대기하고, 사용자 메시지를 먼저 처리한 뒤 큐 순서대로 재개한다.

---

## 6. 실행 방법

```bash
# Windows (권장)
run.bat

# 수동 실행
npm install && cd dashboard && npm install && cd ..
npm run dev              # Dashboard 실행 (localhost:5173)

# 프로덕션
npm run build && npm start
```

**사용자 경험:**
1. `run.bat` 실행 (의존성 설치 + 빌드 + 서버 시작)
2. 브라우저에서 `http://localhost:5173` 접속
3. 프로젝트 폴더 선택
4. ClaudeBot이 AGENTS.md와 docs/ 폴더를 자동으로 읽고 먼저 인사
5. 자유 대화로 목표 설정 → 5-Phase 워크플로우 진행

---

## 7. 비용 관리

| 정책 | 설명 |
|------|------|
| 전역 예산 한도 | `maxTotalBudgetUsd`로 총 비용 제한 |
| Phase별 예산 | 각 Phase의 봇에 개별 예산 할당 |
| 실시간 모니터링 | Dashboard에서 현재 비용 확인 |
| 초과 시 자동 중단 | 예산 한도 도달 시 즉시 알림 + 중단 |

---

## 8. 성공 지표

| 지표 | 목표 |
|------|------|
| 대화에서 개발 시작까지 시간 | 15분 이내 |
| 5-Phase 완주율 | 80% 이상 |
| 사용자 개입 없는 Phase 4 자율 실행율 | 70% 이상 |
| Output Preview vs 실제 결과 일치율 | 80% 이상 |

---

## 9. 구현 로드맵

| 단계 | 산출물 | 상태 |
|------|--------|------|
| v0.1 | Dashboard 웹 앱 기본 구조 | ✅ 완료 |
| v0.2 | ChatPage + WorkflowEngine (5-Phase) | ✅ 완료 |
| v0.3 | HTML Output Preview (Prediction Phase) | 🔄 진행 중 |
| v0.4 | Agent SDK 연동 (BotComposer) | 계획 |
| v0.5 | Phase별 봇 자동 구성 + 실행 | 계획 |
| v0.6 | Review + 보고서 생성 | 계획 |
| v0.7 | Epic Cycle + Auto-Pilot | 계획 |
| v1.0 | 전체 5-Phase 워크플로우 완성 | 계획 |
