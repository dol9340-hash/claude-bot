# Server AGENTS.md

Fastify 5 백엔드 — 워크플로우 엔진, 채팅 관리, 파일 감시 서비스.

## AppState Pattern

`index.ts`에서 `app.decorate('appState', state)`로 전역 상태를 주입한다.
모든 route에서 `fastify.appState`로 접근:

```ts
interface AppState {
  projectPath: string | null;
  watcher: Watcher;
  chatManager: ChatManager;
  workflowEngine: WorkflowEngine;
}
```

## Route 추가 방법

1. `routes/` 디렉토리에 새 파일 생성
2. `export async function myRoute(app: FastifyInstance) { ... }` 형태로 export
3. `index.ts`에서 `await app.register(myRoute, { prefix: '/api' })` 등록

현재 등록된 9개 route: sessions, tasks, config, summary, project, events, chat, report, health.

## Services (3개 핵심)

- **WorkflowEngine** — 5-Phase 상태 머신. 메시지를 현재 phase에 따라 라우팅, Decision Card 생성, 봇 구성 관리.
- **ChatManager** — WebSocket 클라이언트 관리, `.claudebot/chat.json` 영속화, 상태 브로드캐스트 (messages, workflow, decisions, bots).
- **Watcher** — Chokidar 기반 `.claudebot/` 디렉토리 감시, SSE 이벤트 발행 (500ms debounce).

## Communication Protocols

- **WebSocket** (`/api/chat/ws`) — 양방향 실시간. Client → `{ type: 'chat' | 'decision' }`, Server → `{ type: 'chat' | 'workflow' | 'decision' | 'bots' | 'error' }`.
- **SSE** (`/api/events`) — 서버→클라이언트 단방향. 파일 변경 알림.
- **REST** (`/api/*`) — CRUD. WebSocket 불가 시 폴백으로도 사용.

## Decision Cards

타입: `prediction`, `documentation`, `proposal`, `review`, `question`.
Phase 전환은 사용자가 Decision Card에 응답해야 진행.
Onboarding → Prediction은 "다음"/"next"/"proceed" 키워드로 전환.

## Prediction Phase — HTML Preview

- 최종 결과물 예측을 HTML로 생성하여 사용자에게 제시.
- 목적: ① 최종 결과물 형태 ② 핵심 흐름 ③ 완료 기준.
- 사용자 승인 후 개발 진행.

## Nested Sub-Agent Model

- 역할 분리: Planner / Implementer / Reviewer / Verifier
- 각 역할은 자신의 출력물만 작성, handoff로 전달.
- 충돌 우선순위: Reviewer(리스크) → Planner(범위) → Implementer(방법)

## Data Persistence

- 모든 상태: `.claudebot/` 디렉토리 파일 기반 JSON.
- 채팅 이력: `.claudebot/chat.json` — ChatManager가 읽기/쓰기 담당.
- DB 없음.
