# Client AGENTS.md

React 19 SPA — Vite + Tailwind CSS 4.

## State Management

- React hooks + Context only. 외부 상태 라이브러리 사용하지 않는다.
- `useProject()` — localStorage 기반 프로젝트 경로 상태.

## Hooks (4개)

- `useWebSocket()` — 주 실시간 채널. 자동 재연결 (exponential backoff: 1s → 30s max). WS 메시지가 모든 채팅 상태를 주도.
- `useSSE()` — 파일 변경 알림 전용 (보조 채널).
- `useApi()` — REST API 래퍼.
- `useProject()` — 프로젝트 경로 (localStorage).

## Import Rules

- shared 타입은 반드시 `@shared/*` alias로 import. 예: `import type { ChatMessageDTO } from '@shared/api-types'`
- 상대 경로(`../../shared/`)로 shared를 import하지 않는다.

## Pages (7개)

ChatPage (메인 UI), DashboardPage, SessionsPage, TasksPage, AnalyticsPage, ConfigPage, ProjectSelectPage.

## Component Structure

```text
components/
├── analytics/   # 차트 4개 (Cost, Duration, EngineSplit, CostPerTask)
├── chat/        # ChatInput, ChatTimeline, DecisionCard, WorkflowBar, BotStatusPanel, NotificationToast, ChatSearchBar
├── common/      # EngineBadge, StatusBadge, FormatCost, FormatDuration, LoadingSpinner, EmptyState
├── config/      # ConfigViewer
├── dashboard/   # SummaryCards, BudgetGauge, StatusDistribution, RecentSessions
├── layout/      # Layout, Header, Sidebar
├── project/     # ProjectSelector
├── sessions/    # SessionTable, SessionFilters
└── tasks/       # TaskList, TaskItem
```

## Optimistic UI Pattern

- ChatPage에서 사용자 메시지는 서버 응답 전에 즉시 UI에 표시.
- WebSocket 불가 시 REST 폴백으로 전송.

## Tab Notification

- 브라우저 탭 비활성 시 unread count를 title에 표시 (`(N) ClaudeBot`).
