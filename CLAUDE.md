# CLAUDE.md

This file provides guidance to Claude Code when working with this repository.

## Build & Dev Commands

```bash
npm run build      # root tsc + dashboard client + server
npm run dev        # Fastify (3001) + Vite dev (5173) concurrently
npm start          # production
npm run typecheck  # root + dashboard server + dashboard client
run.bat            # Windows: installs deps, builds, starts dev
```

No test framework or linter is currently configured.

## Architecture

ClaudeBot은 **대화 기반 개발 오케스트레이터** — 5-Phase 워크플로우를 통해 사용자와 대화하는 단일 웹 앱이다. CLI 없음.

**Two-layer structure:**

- `src/` — 공유 백엔드 코어: 진입점, IExecutor/SdkExecutor, config 로더, 코어 타입
- `dashboard/` — 풀스택 웹 앱: Fastify 5 서버 + React 19 SPA (상세 → `dashboard/CLAUDE.md`)

**Start flow:**

1. `run.bat` → Dashboard가 `http://localhost:5173`에서 열림
2. 사용자가 프로젝트 폴더 선택 → `POST /api/project`
3. `WorkflowEngine.initializeProject()` — `AGENTS.md`, `docs/*.md`, `claudebot.config.json` 읽기
4. ClaudeBot이 인사 메시지 전송 → workflow가 `onboarding`으로 전환

**Workflow phases:**

```
idle → onboarding → prediction → documentation → development → review → completed
```

Phase 전환은 **Decision Card**를 통한 사용자 명시적 액션이 필요. Onboarding은 "다음"/"next"/"proceed"로 진행.

**Data storage:** `.claudebot/` 디렉토리의 파일 기반 JSON. DB 없음. 채팅 이력은 `.claudebot/chat.json`.

## TypeScript Configuration

3개의 독립 tsconfig — 상세는 각 모듈 CLAUDE.md 참조:

- Root `tsconfig.json` — ES2022, Node16, `src/` → `dist/`
- `dashboard/tsconfig.json` — Client (bundler resolution, `@shared/*` alias)
- `dashboard/tsconfig.server.json` — Server (Node16, `dashboard/dist/`)

## Key Conventions

- ESM throughout (`"type": "module"` in both package.json)
- 한국어: PRD, 사용자 문서, 커밋 메시지
- SDK-only 엔진 — `EngineType = 'sdk'`, CLI 폴백 없음 (상세 → `src/engine/CLAUDE.md`)
- Config 파일: `claudebot.config.json` (대상 프로젝트 루트)
- 포트: Fastify 3001, Vite dev 5173

## Prediction Phase — HTML Preview

- 최종 결과물의 예측 결과를 HTML로 생성, 사용자 승인 후 온보딩하여 개발 진행.
- HTML Preview 목적 3가지: ① 최종 결과물 형태 ② 사용자 관점 핵심 흐름 ③ 완료 기준

## Nested Sub-Agent Model

- 단일 책임 분리: **Planner** / **Implementer** / **Reviewer** / **Verifier**
- 각 역할은 자신의 출력물만 작성, 다음 역할로 handoff.
- 충돌 우선순위: Reviewer(리스크) → Planner(범위) → Implementer(방법)

## CLAUDE.md Hierarchy

- **가까운 경로의 CLAUDE.md**가 우선.
- 루트: 전역 최소 규칙. 로컬: 예외와 구현 디테일.
- 로컬 파일: `dashboard/`, `dashboard/src/server/`, `dashboard/src/client/`, `src/engine/`

## Lightweight Maintenance Policy

- 점검 주기: 2주 또는 Sprint 종료 시.
- 즉시 갱신: 아키텍처 변경, 새 tool/process 도입, 같은 실패 2회+, 규칙 충돌.
- 예산: 루트 ≤ 120줄, 로컬 ≤ 80줄, 1규칙 = 1문장.
- 2회 점검 동안 미사용 규칙은 삭제 또는 하위 문서로 이동.
- 변경 기록: `docs/.history/agents/YYYY-MM-DD.md`
