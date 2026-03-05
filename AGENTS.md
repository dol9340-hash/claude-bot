# AGENTS.md

## 1. Core Goal
- 이 문서는 개발 실행 규칙을 짧고 명확하게 유지한다.
- 루트 문서는 공통 불변 규칙만 담고, 세부 규칙은 하위 AGENTS로 분리한다.

## 2. Instruction Priority (Mandatory)
- 우선순위는 `System/Platform -> User Chat -> Nearest AGENTS.md -> Parent AGENTS.md` 순으로 적용한다.
- 같은 레벨 규칙이 충돌하면 최신 합의 규칙을 우선한다.
- 로컬 규칙이 전역 규칙을 덮을 때는 이유를 로컬 AGENTS에 1문장으로 남긴다.

## 3. Non-Negotiables
- 추측 금지: 기존 문서 -> 공식 문서 -> 웹 검색 -> 사용자 확인 순서로 확인한다.
- 문서와 코드 동기화: 행동 규칙이 바뀌면 AGENTS를 먼저 갱신한다.
- 1 변경 = 1 목적: 큰 변경은 작은 단위로 나눠 검증한다.

## 4. Build & Dev Commands

```bash
npm run build      # root tsc + dashboard client + server
npm run dev        # Fastify (3001) + Vite dev (5173) concurrently
npm start          # production
npm run typecheck  # root + dashboard server + dashboard client
run.bat            # Windows: installs deps, builds, starts dev
```

No test framework or linter is currently configured.

## 5. Architecture

ClaudeBot은 **대화 기반 개발 오케스트레이터** — 5-Phase 워크플로우를 통해 사용자와 대화하는 단일 웹 앱이다. CLI 없음.

**Two-layer structure:**

- `src/` — 공유 백엔드 코어: 진입점, IExecutor/SdkExecutor, config 로더, 코어 타입
- `dashboard/` — 풀스택 웹 앱: Fastify 5 서버 + React 19 SPA (상세 → `dashboard/AGENTS.md`)

**Start flow:**

1. `run.bat` → Dashboard가 `http://localhost:5173`에서 열림
2. 사용자가 프로젝트 폴더 선택 → `POST /api/project`
3. `WorkflowEngine.initializeProject()` — `AGENTS.md`, `docs/*.md`, `claudebot.config.json` 읽기
4. ClaudeBot이 인사 메시지 전송 → workflow가 `onboarding`으로 전환

**Workflow phases:**

```text
idle → onboarding → prediction → documentation → development → review → completed
```

Phase 전환은 **Decision Card**를 통한 사용자 명시적 액션이 필요. Onboarding은 "다음"/"next"/"proceed"로 진행.

**Data storage:** `.claudebot/` 디렉토리의 파일 기반 JSON. DB 없음. 채팅 이력은 `.claudebot/chat.json`.

## 6. TypeScript Configuration

3개의 독립 tsconfig — 상세는 각 모듈 AGENTS.md 참조:

- Root `tsconfig.json` — ES2022, Node16, `src/` → `dist/`
- `dashboard/tsconfig.json` — Client (bundler resolution, `@shared/*` alias)
- `dashboard/tsconfig.server.json` — Server (Node16, `dashboard/dist/`)

## 7. Key Conventions

- ESM throughout (`"type": "module"` in both package.json)
- 한국어: PRD, 사용자 문서, 커밋 메시지
- SDK-only 엔진 — `EngineType = 'sdk'`, CLI 폴백 없음 (상세 → `src/engine/AGENTS.md`)
- Config 파일: `claudebot.config.json` (대상 프로젝트 루트)
- 포트: Fastify 3001, Vite dev 5173

## 8. Pre-Onboarding Visual Target Gate (Mandatory)
- 모든 개발 작업은 온보딩 완료 직전에 `결과물 형태 예측` 단계를 반드시 수행한다.
- 예측 결과는 반드시 HTML로 시각화한다.
- HTML 시안에는 아래 항목을 반드시 포함한다.
- 최종 결과물 형태
- 사용자 핵심 흐름
- 완료 기준(Goal Target)
- 제외 범위(Out of Scope)
- 승인자/승인일
- 사용자가 HTML 시안을 승인한 시점을 온보딩 완료로 정의한다.
- 승인 전에는 구현 범위를 고정하지 않고, 승인 후에는 승인된 목표를 기준으로 구현한다.

## 9. Nested Sub-Agent Model
- 역할은 단일 책임으로 분리한다: Planner / Implementer / Reviewer / Verifier
- 각 역할은 handoff 시 아래 4개를 반드시 포함한다.
- Input
- Output
- Done Condition
- Escalation Condition
- 역할 충돌 시 우선순위는 `Reviewer(리스크) -> Planner(범위) -> Implementer(방법)`이다.
- 중첩 깊이는 기본 1단계로 제한하고, 필요 시 사용자 승인 후 2단계까지 허용한다.
- 모듈별 세부 규칙은 해당 폴더의 `AGENTS.md`에서 관리한다.

## 10. AGENTS Hierarchy

- 규칙 적용 우선순위는 `가까운 경로의 AGENTS.md`가 우선이다.
- 루트 `AGENTS.md`는 전역 최소 규칙만 유지한다.
- 서비스/모듈 폴더는 로컬 `AGENTS.md`로 예외와 구현 디테일을 분리한다.
- 로컬 파일: `dashboard/`, `dashboard/src/server/`, `dashboard/src/client/`, `src/engine/`

## 11. Lightweight Maintenance Policy

- 정기 점검 주기: 2주 또는 Sprint 종료 시.
- 즉시 갱신 트리거: 아키텍처 변경, 새 tool/process 도입, 같은 실패 패턴 2회 이상 반복, 규칙 충돌 발생.
- 경량 예산: 루트 AGENTS 120줄 이하, 로컬 AGENTS 80줄 이하, 규칙 1개 1문장 원칙.
- 2회 점검 동안 사용되지 않은 규칙은 삭제 또는 하위 문서로 이동한다.
- 모든 변경은 `docs/.history/agents/YYYY-MM-DD.md`에 이유와 diff 요약을 기록한다.
- 각 AGENTS 파일은 아래 메타 필드를 문서 상단에 둔다.
- Owner
- Next Review Date
- Tracking Issue

## 12. Minimum Runbook (Standard)

- Setup: 프로젝트 기본 의존성 설치 명령 1개를 명시한다.
- Test: 핵심 테스트 명령 1개를 명시한다.
- Verify: 빌드 또는 스모크 검증 명령 1개를 명시한다.
- 명령은 복사-실행 가능한 형태로 유지한다.

## 13. Standard Execution Loop

- Plan -> Visual Target HTML -> User Approval -> Onboarding Complete -> Implement -> Test -> Verify -> Log
