# ClaudeBot Dashboard Web App - 개발 계획서

> 버전: 0.1.0 — 작성일: 2026-03-01
> 상태: 승인 (Approved)
> 선행 조건: Phase 1 완료 (현재 상태)

---

## 1. 개요

### 1.1 해결하려는 문제

ClaudeBot은 CLI 기반 자율 작업 큐 오케스트레이터로, 작업 결과가 `.claudebot/sessions.json`과 `tasks.md`에 파일로 저장된다. 현재 실행 결과를 시각적으로 확인할 방법이 없어 작업 이력, 비용, 성공률 등을 한눈에 파악하기 어렵다.

### 1.2 목표

**작업 폴더를 지정하면 해당 프로젝트의 ClaudeBot 실행 결과를 시각화하는 독립 웹 대시보드**를 구축한다.

### 1.3 사용 시나리오

```bash
# 방법 1: CLI 인자로 대상 폴더 지정
claudebot-dashboard --project /path/to/my-project

# 방법 2: 환경변수
CLAUDEBOT_PROJECT_DIR=/path/to/my-project claudebot-dashboard

# 방법 3: 웹 UI에서 폴더 경로 입력
# → http://localhost:5173 접속 후 프로젝트 경로 입력
```

---

## 2. 아키텍처

### 2.1 전체 구조

```
dashboard/                         (self-contained, own package.json)
├── server (Fastify)               → .claudebot/ 파일 읽기 + REST API + SSE
├── client (React + Vite)          → 대시보드 UI
└── shared types                   → ../../src/types.ts 재사용
```

### 2.2 데이터 소스 (대상 프로젝트 폴더 기준)

| 파일 | 내용 | 용도 |
|------|------|------|
| `.claudebot/sessions.json` | 세션 이력 | 비용, 시간, 상태, 엔진 추적 |
| `docs/todo.md` (또는 config.tasksFile) | 작업 큐 | 현재 작업 상태 시각화 |
| `claudebot.config.json` | 설정값 | 예산 한도, 엔진 설정 표시 |

### 2.3 데이터 흐름

```
[대상 프로젝트 파일시스템]
   sessions.json  ──┐
   tasks.md        ──┼──► [Fastify 서버: REST API] ──► [HTTP JSON 응답]
   config.json     ──┘         │                              │
                               │ chokidar                     ▼
                               │ 파일 감시              [React 클라이언트]
                               │                        useApi() fetch
                               ▼                              │
                          [SSE 스트림] ─────────────► [useSSE() 자동 리프레시]
                          파일 변경 알림                       │
                                                    ┌─────────┼──────────┐
                                                    ▼         ▼          ▼
                                              [대시보드]  [세션 이력]  [차트]
```

---

## 3. 기술 스택

| Layer | Technology | Version | 선택 이유 |
|-------|-----------|---------|----------|
| Frontend | React + Vite | 19 / 6 | Adv.md Phase 5 로드맵 일치, 넓은 생태계 |
| Styling | Tailwind CSS | v4 | 빠른 UI 개발, 다크 테마 지원, zero-config |
| Charts | Recharts | 2.15+ | React 네이티브, 타임라인/바/파이 차트 지원 |
| Backend | Fastify | 5.x | 경량, TypeScript 내장 타입, 플러그인 구조 |
| File Watch | chokidar | 4.x | Windows ReadDirectoryChangesW 활용, 안정적 |
| Dev | concurrently + tsx | — | 서버/클라이언트 동시 개발 |
| Date | date-fns | 4.x | 경량 날짜 포맷팅 |

### 3.1 대안 비교

| 항목 | 선택 | 대안 | 비선택 이유 |
|------|------|------|------------|
| Frontend | React | Preact (3KB), Vanilla TS | 생태계/Phase 5 호환성 우선 |
| Backend | Fastify | Express, node:http | Fastify가 더 빠르고 타입 안전 |
| Charts | Recharts | uPlot (35KB), Chart.js | React 통합 편의성, 다양한 차트 타입 |
| CSS | Tailwind v4 | CSS Modules, styled-components | v4 zero-config, 빠른 반복 개발 |
| File Watch | chokidar | fs.watch | Windows 안정성, 디바운스 내장 |

---

## 4. 디렉토리 구조

```
e:/AI/claude-bot/
  dashboard/
    package.json
    tsconfig.json                    # Frontend (React JSX, bundler resolution)
    tsconfig.server.json             # Server (Node16)
    vite.config.ts                   # React, Tailwind, /api 프록시
    index.html                       # Vite 진입 HTML

    src/
      server/
        index.ts                     # Fastify 서버 진입점 (CLI 인자 파싱)
        routes/
          sessions.ts                # GET /api/sessions
          tasks.ts                   # GET /api/tasks
          config.ts                  # GET /api/config
          summary.ts                 # GET /api/summary (집계 분석)
          project.ts                 # GET/POST /api/project (폴더 관리)
          events.ts                  # GET /api/events (SSE 스트림)
        services/
          file-reader.ts             # 프로젝트 파일 읽기/파싱
          task-parser.ts             # tasks.md 파싱 (모든 상태 포함)
          watcher.ts                 # chokidar + SSE 브로드캐스트

      shared/
        types.ts                     # ../../src/types.ts 재수출
        api-types.ts                 # API 전용 인터페이스

      client/
        main.tsx                     # React 렌더링 진입점
        App.tsx                      # React Router 설정
        hooks/
          useApi.ts                  # fetch + 캐싱 + 자동 리프레시
          useSSE.ts                  # EventSource 훅 (자동 재연결)
          useProject.ts              # 프로젝트 경로 상태 관리
        pages/
          DashboardPage.tsx          # 메인 대시보드
          SessionsPage.tsx           # 세션 이력
          TasksPage.tsx              # 작업 큐
          AnalyticsPage.tsx          # 비용/시간 분석
          ConfigPage.tsx             # 설정 뷰어
          ProjectSelectPage.tsx      # 프로젝트 선택
        components/
          layout/
            Layout.tsx               # 사이드바 + 메인 쉘
            Sidebar.tsx              # 네비게이션
            Header.tsx               # 프로젝트 경로 + 연결 상태
          dashboard/
            SummaryCards.tsx          # 총 작업 / 비용 / 성공률 / 평균 시간
            StatusDistribution.tsx   # 도넛 차트
            BudgetGauge.tsx          # 예산 사용률
            RecentSessions.tsx       # 최근 5개 세션
          sessions/
            SessionTable.tsx         # 전체 세션 이력 테이블
            SessionFilters.tsx       # 상태/엔진/날짜 필터
          tasks/
            TaskList.tsx             # 작업 큐 (전체 상태)
            TaskItem.tsx             # 개별 작업 (태그, 재시도 표시)
          analytics/
            CostTrendChart.tsx       # 누적 비용 타임라인
            CostPerTaskChart.tsx     # 작업별 비용 바 차트
            DurationChart.tsx        # 작업별 소요 시간
            EngineSplitChart.tsx     # SDK vs CLI 비교
          config/
            ConfigViewer.tsx         # 설정값 포맷 표시
          project/
            ProjectSelector.tsx      # 폴더 경로 입력 + 최근 목록
          common/
            StatusBadge.tsx          # 상태별 색상 뱃지
            EngineBadge.tsx          # SDK/CLI 뱃지
            FormatCost.tsx           # $0.0784 포맷
            FormatDuration.tsx       # "1m 23s" 포맷
            EmptyState.tsx
            LoadingSpinner.tsx
```

---

## 5. API 설계

### 5.1 REST Endpoints

| Method | Path | Description | Response |
|--------|------|-------------|----------|
| `GET` | `/api/project` | 현재 프로젝트 정보 | `ProjectInfo` |
| `POST` | `/api/project` | 프로젝트 경로 변경 | `ProjectInfo` |
| `GET` | `/api/sessions` | 전체 세션 이력 | `SessionStore` |
| `GET` | `/api/tasks` | 파싱된 전체 작업 목록 | `Task[]` |
| `GET` | `/api/config` | ClaudeBot 설정 | `ClaudeBotConfig` |
| `GET` | `/api/summary` | 집계 분석 데이터 | `DashboardSummary` |
| `GET` | `/api/events` | SSE 실시간 스트림 | `text/event-stream` |

### 5.2 API 타입 정의

```typescript
// 프로젝트 정보
interface ProjectInfo {
  path: string;
  valid: boolean;
  hasSessionsFile: boolean;
  hasConfigFile: boolean;
  hasTasksFile: boolean;
  tasksFilePath: string;
}

// 대시보드 요약 (서버에서 계산)
interface DashboardSummary {
  totalTasks: number;           // 전체 작업 수
  completedTasks: number;       // 완료
  failedTasks: number;          // 실패
  pendingTasks: number;         // 대기
  totalCostUsd: number;         // 총 비용
  averageCostPerTask: number;   // 작업당 평균 비용
  averageDurationMs: number;    // 평균 소요 시간
  totalDurationMs: number;      // 총 소요 시간
  engineBreakdown: {            // 엔진별 분석
    sdk: { count: number; costUsd: number };
    cli: { count: number; costUsd: number };
  };
  budgetUsagePercent: number | null;  // 예산 사용률 (설정 시)
  recentSessions: SessionRecord[];    // 최근 5개 세션
}

// SSE 이벤트
type SSEEvent =
  | { type: 'connected' }
  | { type: 'sessions_updated' }
  | { type: 'tasks_updated' }
  | { type: 'config_updated' }
  | { type: 'heartbeat' };
```

### 5.3 기존 타입 재사용

`dashboard/src/shared/types.ts`에서 메인 프로젝트의 타입을 직접 재수출:

```typescript
export type {
  SessionStore, SessionRecord, ClaudeBotConfig, Task,
  TaskStatus, EngineType, SwarmConfig, CostSummary
} from '../../../src/types.js';
```

---

## 6. 백엔드 상세 설계

### 6.1 서버 진입점 (`server/index.ts`)

```typescript
// 프로젝트 경로 결정 우선순위:
// 1. CLI: --project /path/to/project
// 2. ENV: CLAUDEBOT_PROJECT_DIR
// 3. 미지정 시: 웹 UI에서 입력 요구

// Fastify 서버 구성:
// - Port: 3001 (default)
// - CORS: dev 모드에서 활성화
// - Static: 프로덕션에서 dist/client/ 서빙
// - Routes: /api/* 등록
// - Watcher: 프로젝트 경로 설정 시 chokidar 시작
```

### 6.2 파일 리더 서비스 (`services/file-reader.ts`)

| 메서드 | 입력 | 출력 | 설명 |
|--------|------|------|------|
| `readSessionStore(projectPath)` | 프로젝트 경로 | `SessionStore \| null` | sessions.json 파싱 |
| `readConfig(projectPath)` | 프로젝트 경로 | `Partial<ClaudeBotConfig> \| null` | config.json 파싱 |
| `readTasks(projectPath, tasksFile)` | 프로젝트 경로 + 파일명 | `Task[]` | 모든 상태의 작업 반환 |
| `validateProject(projectPath)` | 프로젝트 경로 | `ProjectInfo` | 파일 존재 여부 검증 |

### 6.3 대시보드 전용 태스크 파서 (`services/task-parser.ts`)

기존 `src/task/parser.ts`를 기반으로 하되, **모든 상태를 반환**하도록 수정:

```typescript
// 기존 파서: completed([x])와 failed([!])를 스킵
// 대시보드 파서: 모든 체크박스를 파싱하여 상태 매핑
//   ' ' → 'pending'
//   'x'/'X' → 'completed'
//   '!' → 'failed'

const CHECKBOX_RE = /^(\s*[-*]\s*)\[([ xX!])\]\s+(.+)$/;
const TAG_RE = /\[(\w+):([^\]]+)\]/g;
```

### 6.4 파일 감시 서비스 (`services/watcher.ts`)

```
chokidar.watch([
  '{projectPath}/.claudebot/sessions.json',
  '{projectPath}/{tasksFile}',
  '{projectPath}/claudebot.config.json'
])
  → 500ms 디바운스
  → SSE 클라이언트 Set에 이벤트 브로드캐스트
  → 프로젝트 경로 변경 시 기존 watcher 종료 + 새 watcher 시작
```

---

## 7. 프론트엔드 상세 설계

### 7.1 페이지 구성

| Route | Page | 주요 기능 |
|-------|------|----------|
| `/` | DashboardPage | 요약 카드 4개 + 상태 도넛 차트 + 예산 게이지 + 최근 세션 |
| `/sessions` | SessionsPage | 전체 세션 테이블 (정렬/필터) |
| `/tasks` | TasksPage | 작업 큐 전체 (탭 필터: All/Pending/Completed/Failed) |
| `/analytics` | AnalyticsPage | 비용 추이, 작업별 비용/시간, 엔진 비교 차트 |
| `/config` | ConfigPage | 설정값 읽기 전용 표시 |
| `/project` | ProjectSelectPage | 프로젝트 경로 입력 + 최근 목록 |

### 7.2 레이아웃

```
+================================================================+
| HEADER: [프로젝트 경로] [연결 상태 ●]                            |
+================================================================+
| SIDEBAR (200px) | MAIN CONTENT (1fr)                           |
| ┌──────────┐    | ┌──────────────────────────────────────────┐ |
| │ Dashboard │    | │                                          │ |
| │ Sessions  │    | │  (현재 페이지 내용)                       │ |
| │ Tasks     │    | │                                          │ |
| │ Analytics │    | │                                          │ |
| │ Config    │    | │                                          │ |
| │           │    | │                                          │ |
| │ ───────── │    | │                                          │ |
| │ [Project] │    | │                                          │ |
| └──────────┘    | └──────────────────────────────────────────┘ |
+================================================================+
```

### 7.3 대시보드 메인 페이지 상세

```
+──────────────────────────────────────────────────────────────+
| [총 작업: 13]  [총 비용: $1.00]  [성공률: 100%]  [평균: 53.2s] |
+──────────────────────────────────────────────────────────────+
| 상태 분포 (도넛)        | 예산 사용률                          |
| ┌─────────────────┐    | ┌──────────────────────────────┐    |
| │  ● Completed 13 │    | │ ████████░░░░░░  $1.00/$20.00 │    |
| │  ● Failed    0  │    | │ 5.0% 사용                     │    |
| │  ● Pending   0  │    | └──────────────────────────────┘    |
| └─────────────────┘    |                                      |
+────────────────────────+──────────────────────────────────────+
| 최근 세션                                                      |
| ┌────────────────────────────────────────────────────────────┐ |
| │ # │ Task                    │ Status │ Cost   │ Time │ Eng │ |
| │ 1 │ 재미있는 이야기 3줄...    │  ✓    │ $0.11 │ 52.7s│ CLI │ |
| │ 2 │ 재미없는 이야기 3줄...    │  ✓    │ $0.06 │ 110s │ CLI │ |
| │ 3 │ 다음 이야기 랜덤하게...   │  ✓    │ $0.13 │ 153s │ CLI │ |
| │ ...                                                        │ |
| └────────────────────────────────────────────────────────────┘ |
+──────────────────────────────────────────────────────────────+
```

### 7.4 핵심 Hooks

```typescript
// useApi<T>(endpoint) → { data, error, loading, refetch }
// - fetch wrapper + 로딩/에러 상태 관리
// - SSE 이벤트 수신 시 자동 refetch

// useSSE(onEvent) → { connected }
// - /api/events 연결, 자동 재연결 (exponential backoff)
// - 연결 상태를 Header에 표시

// useProject() → { projectPath, setProject, recentProjects }
// - localStorage에 최근 프로젝트 경로 저장
// - POST /api/project로 서버 경로 변경
```

---

## 8. 디자인 명세

### 8.1 다크 테마 컬러

| Token | Hex | 용도 |
|-------|-----|------|
| `--bg-base` | `#0d1117` | 페이지 배경 |
| `--bg-surface` | `#161b22` | 카드/패널 배경 |
| `--bg-elevated` | `#21262d` | 호버/활성 탭 |
| `--bg-overlay` | `#30363d` | 툴팁/드롭다운 |
| `--text-primary` | `#e6edf3` | 주요 텍스트/헤딩 |
| `--text-secondary` | `#8b949e` | 레이블/보조 텍스트 |
| `--text-muted` | `#484f58` | 비활성/플레이스홀더 |
| `--color-success` | `#3fb950` | completed 상태 |
| `--color-danger` | `#f85149` | failed 상태 |
| `--color-warning` | `#d29922` | running/pending |
| `--color-info` | `#58a6ff` | 링크/정보 |
| `--color-sdk` | `#a371f7` | SDK 엔진 뱃지 (보라) |
| `--color-cli` | `#79c0ff` | CLI 엔진 뱃지 (파랑) |

### 8.2 타이포그래피

| 요소 | 폰트 | 크기 | 굵기 |
|------|------|------|------|
| 카드 숫자 | Monospace | 28px | 700 |
| 카드 레이블 | Sans-serif | 12px | 400 |
| 테이블 헤더 | Sans-serif | 11px | 600 (대문자) |
| 테이블 본문 | Monospace | 13px | 400 |
| 네비게이션 | Sans-serif | 14px | 500 |

- 모노스페이스: `'Cascadia Code', 'JetBrains Mono', 'Fira Code', monospace`
- Sans-serif: `system-ui, -apple-system, sans-serif`

### 8.3 컴포넌트 스타일

- **Border radius**: 카드 8px, 뱃지 6px, 인풋 4px
- **Borders**: `1px solid #30363d`
- **Shadows**: 최소 사용 (오버레이만 `0 -4px 16px rgba(0,0,0,0.3)`)
- **Spacing**: 8px 기본 단위, 카드 내부 16px, 카드 간격 12px
- **Transitions**: 호버 150ms ease, 패널 200ms

### 8.4 상태 표시

| 상태 | 색상 | 아이콘 | 뱃지 텍스트 |
|------|------|--------|-----------|
| completed | `#3fb950` | ✓ 채워진 원 | Completed |
| failed | `#f85149` | ✕ | Failed |
| running | `#d29922` | 회전 스피너 | Running |
| pending | `#58a6ff` | ○ 빈 원 | Pending |
| skipped | `#6e7681` | ─ 대시 | Skipped |

---

## 9. 구현 단계

### Step 1: 프로젝트 스캐폴딩

**생성 파일:**
- `dashboard/package.json` — 의존성 정의
- `dashboard/tsconfig.json` — React/JSX, bundler resolution
- `dashboard/tsconfig.server.json` — Node16 서버
- `dashboard/vite.config.ts` — React, Tailwind, `/api` → localhost:3001 프록시
- `dashboard/index.html` — Vite 진입 HTML
- `dashboard/src/shared/types.ts` — 메인 프로젝트 타입 재수출
- `dashboard/src/shared/api-types.ts` — DashboardSummary, ProjectInfo 등

### Step 2: 백엔드 서버 (Fastify + API Routes)

**생성 파일:**
- `server/index.ts` — Fastify 서버 (포트 3001, CLI --project 인자)
- `server/services/file-reader.ts` — 파일 읽기 (null-safe)
- `server/services/task-parser.ts` — 전체 상태 태스크 파서
- `server/routes/sessions.ts` — GET /api/sessions
- `server/routes/tasks.ts` — GET /api/tasks
- `server/routes/config.ts` — GET /api/config
- `server/routes/summary.ts` — GET /api/summary (집계 계산)
- `server/routes/project.ts` — GET/POST /api/project

### Step 3: 실시간 업데이트 (SSE + chokidar)

**생성 파일:**
- `server/services/watcher.ts` — chokidar 감시 + 500ms 디바운스 + SSE 브로드캐스트
- `server/routes/events.ts` — SSE 엔드포인트 (30초 하트비트)

### Step 4: 프론트엔드 기반

**생성 파일:**
- `client/main.tsx` — React 렌더링 진입점
- `client/App.tsx` — React Router (6개 라우트)
- `client/hooks/useApi.ts` — fetch + 상태 관리 + SSE 연동
- `client/hooks/useSSE.ts` — EventSource + 자동 재연결
- `client/hooks/useProject.ts` — 프로젝트 경로 + localStorage
- `client/components/layout/Layout.tsx` — CSS Grid 쉘
- `client/components/layout/Sidebar.tsx` — 네비게이션
- `client/components/layout/Header.tsx` — 상태 표시

### Step 5: 대시보드 메인 페이지

**생성 파일:**
- `SummaryCards.tsx` — 4개 요약 카드
- `StatusDistribution.tsx` — Recharts PieChart (도넛)
- `BudgetGauge.tsx` — 예산 프로그레스 바
- `RecentSessions.tsx` — 최근 5개 세션 미니 테이블

### Step 6: 세션 이력 페이지

**생성 파일:**
- `SessionTable.tsx` — 정렬 가능 테이블 (상태, 비용, 시간, 엔진, 재시도, 타임스탬프)
- `SessionFilters.tsx` — 상태/엔진/날짜범위 필터

### Step 7: 작업 큐 페이지

**생성 파일:**
- `TaskList.tsx` — 탭 필터 (All / Pending / Completed / Failed)
- `TaskItem.tsx` — 태그 뱃지, 연관 세션 링크

### Step 8: 분석 페이지 (Charts)

**생성 파일:**
- `CostTrendChart.tsx` — LineChart: 누적 비용 추이 + 예산 기준선
- `CostPerTaskChart.tsx` — BarChart: 작업별 비용 (상태 색상)
- `DurationChart.tsx` — BarChart: 작업별 소요 시간
- `EngineSplitChart.tsx` — PieChart: SDK vs CLI 비교

### Step 9: 설정 뷰어 & 프로젝트 선택

**생성 파일:**
- `ConfigViewer.tsx` — 섹션별 설정 표시 (Engine, Budget, Execution, Swarm)
- `ProjectSelector.tsx` — 경로 입력 + 유효성 검증 + 최근 목록

### Step 10: 통합 및 마무리

- 루트 `.gitignore`에 `dashboard/node_modules/`, `dashboard/dist/` 추가
- 루트 `package.json`에 편의 스크립트: `"dashboard": "cd dashboard && npm run dev"`
- 프로덕션 빌드: `npm run build` → client(`dist/client/`) + server(`dist/server/`)
- `dashboard/package.json`의 bin에 `claudebot-dashboard` 등록

---

## 10. 핵심 참조 파일 (기존 프로젝트)

| 파일 | 역할 |
|------|------|
| `src/types.ts` | 모든 데이터 인터페이스 원본 — 타입 공유 소스 |
| `src/task/parser.ts` | 태스크 파서 참조 구현 (CHECKBOX_RE, TAG_RE) |
| `src/session/manager.ts` | sessions.json 읽기/쓰기 패턴 |
| `src/config.ts` | Zod 스키마 + config 기본값 |
| `.claudebot/sessions.json` | 실제 세션 데이터 13건 — 개발 테스트 픽스처 |

---

## 11. 검증 계획

| # | 테스트 항목 | 방법 | 기대 결과 |
|---|-----------|------|----------|
| 1 | 서버 동작 | `cd dashboard && npm run dev` → http://localhost:5173 | 페이지 정상 렌더링 |
| 2 | 데이터 표시 | sessions.json 13건 확인 | 테이블/차트에 13건 표시 |
| 3 | 실시간 갱신 | sessions.json 수동 수정 | SSE로 UI 자동 업데이트 |
| 4 | 폴더 지정 | `--project /other/path` | 해당 폴더 데이터 로드 |
| 5 | 프로덕션 빌드 | `npm run build && npm start` | 정적+API 동시 서빙 |
| 6 | 빈 데이터 | .claudebot/ 없는 폴더 지정 | EmptyState UI 표시 |
| 7 | 프로젝트 전환 | UI에서 경로 변경 | 새 프로젝트 데이터 로드 |

---

## 12. Adv.md 로드맵 연계

이 대시보드는 Adv.md의 Phase 3(TUI Dashboard v1)과 Phase 5(Web Dashboard v2) 사이의 실용적 중간 산출물이다:

- **Phase 3 TUI 대비 장점**: 브라우저 기반으로 차트/테이블 등 풍부한 시각화 가능
- **Phase 5 확장 경로**: React + Vite 기반이므로 WebSocket, 대화형 인터페이스, HTML 보고서 등 Phase 5 기능을 자연스럽게 추가 가능
- **BotGraph 호환**: 사이드바의 Tasks 페이지를 Bot List로, Session Timeline을 Conversation Timeline으로 확장 가능

```
Phase 1 (완료) → [이 대시보드] → Phase 2 BotGraph → Phase 3 TUI → Phase 5 Web v2
                     ↑                                                    ↑
                     └────────── React + Vite 기반 공유 ──────────────────┘
```

---

## 13. 배포 정책

### 13.1 배포 전략 개요

대시보드는 **로컬 개발 도구**로서의 성격과 **팀 공유 모니터링 서비스**로의 확장 가능성을 모두 고려한다.

| 단계 | 배포 형태 | 대상 사용자 | 시기 |
|------|----------|-----------|------|
| **v0.1 (MVP)** | 로컬 실행 | 개발자 본인 | 초기 |
| **v0.2** | npm 패키지 | ClaudeBot 사용자 전체 | 안정화 후 |
| **v1.0** | Docker 이미지 | 팀/서버 환경 | Phase 5 이후 |

### 13.2 v0.1 — 로컬 실행 (개발 단계)

**실행 방법:**
```bash
# 개발 모드 (HMR + 서버 동시 실행)
cd dashboard && npm run dev

# 프로덕션 모드 (빌드 후 실행)
cd dashboard && npm run build && npm start -- --project /path/to/project

# 루트에서 편의 스크립트
npm run dashboard
```

**빌드 산출물:**
```
dashboard/dist/
  client/          # Vite 빌드 (정적 HTML/JS/CSS)
    index.html
    assets/
      index-[hash].js
      index-[hash].css
  server/          # tsc 빌드 (Node.js 서버)
    index.js
    routes/
    services/
```

**배포 없음** — 로컬에서 직접 실행. 소스 코드 형태로 `dashboard/` 디렉토리에 포함.

### 13.3 v0.2 — npm 패키지 배포

**패키지 구성:**
```json
{
  "name": "claudebot-dashboard",
  "version": "0.2.0",
  "bin": {
    "claudebot-dashboard": "dist/server/index.js"
  },
  "files": [
    "dist/"
  ]
}
```

**설치 및 실행:**
```bash
# 글로벌 설치
npm install -g claudebot-dashboard

# 실행
claudebot-dashboard --project /path/to/project

# 또는 npx로 일회성 실행
npx claudebot-dashboard --project .
```

**npm 배포 워크플로우:**
```bash
# 1. 버전 업데이트
cd dashboard
npm version patch  # 또는 minor / major

# 2. 빌드 (client + server)
npm run build

# 3. 배포
npm publish

# 4. Git 태그
git tag dashboard-v0.2.0
git push --tags
```

**배포 전 체크리스트:**
- [ ] `npm run build` 성공 (타입 에러 없음)
- [ ] `npm start -- --project .` 로 로컬 동작 확인
- [ ] 빈 프로젝트 경로 지정 시 EmptyState 정상 표시
- [ ] SSE 연결 및 실시간 업데이트 동작 확인
- [ ] `.npmignore`에 `src/`, `node_modules/`, `*.ts` 제외 확인

### 13.4 v1.0 — Docker 배포 (팀/서버 환경)

**Dockerfile:**
```dockerfile
FROM node:22-alpine AS builder
WORKDIR /app
COPY dashboard/package*.json ./
RUN npm ci
COPY dashboard/ ./
RUN npm run build

FROM node:22-alpine
WORKDIR /app
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./

# 대상 프로젝트 폴더를 볼륨으로 마운트
VOLUME ["/project"]
ENV CLAUDEBOT_PROJECT_DIR=/project

EXPOSE 3001
CMD ["node", "dist/server/index.js"]
```

**Docker 실행:**
```bash
# 빌드
docker build -t claudebot-dashboard .

# 실행 (프로젝트 폴더 마운트)
docker run -d \
  -p 3001:3001 \
  -v /path/to/my-project:/project:ro \
  --name cb-dashboard \
  claudebot-dashboard

# → http://localhost:3001 에서 대시보드 접속
```

**Docker Compose (선택):**
```yaml
services:
  dashboard:
    build:
      context: .
      dockerfile: Dockerfile
    ports:
      - "3001:3001"
    volumes:
      - ./my-project:/project:ro
    environment:
      - CLAUDEBOT_PROJECT_DIR=/project
    restart: unless-stopped
```

### 13.5 환경 설정

| 환경변수 | 기본값 | 설명 |
|----------|--------|------|
| `CLAUDEBOT_PROJECT_DIR` | (없음) | 대상 프로젝트 폴더 경로 |
| `PORT` | `3001` | 서버 포트 |
| `NODE_ENV` | `development` | 환경 (`production` 시 정적 파일 서빙) |

**CLI 인자:**
| 인자 | 단축 | 설명 |
|------|------|------|
| `--project <path>` | `-p` | 대상 프로젝트 폴더 |
| `--port <number>` | 없음 | 서버 포트 (기본 3001) |
| `--open` | `-o` | 시작 시 브라우저 자동 열기 |

### 13.6 버전 관리 정책

**Semantic Versioning:**
- **MAJOR (1.x.x)**: API 구조 변경, 호환성 깨지는 변경
- **MINOR (x.1.x)**: 새로운 페이지/기능 추가
- **PATCH (x.x.1)**: 버그 수정, UI 개선

**태그 규칙:**
```
dashboard-v0.1.0    # 대시보드 전용 태그 (메인 프로젝트와 독립)
dashboard-v0.2.0
```

**브랜치 전략:**
- `main` — 안정 릴리즈
- `feat/dashboard-*` — 대시보드 기능 개발 브랜치
- PR 단위로 머지, 대시보드 관련 변경은 `dashboard/` 경로에만 영향

### 13.7 CI/CD (향후)

```yaml
# .github/workflows/dashboard.yml
name: Dashboard CI

on:
  push:
    paths: ['dashboard/**']
  pull_request:
    paths: ['dashboard/**']

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: 22 }
      - run: cd dashboard && npm ci
      - run: cd dashboard && npm run build

  publish:
    needs: build
    if: startsWith(github.ref, 'refs/tags/dashboard-v')
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 22
          registry-url: 'https://registry.npmjs.org'
      - run: cd dashboard && npm ci && npm run build
      - run: cd dashboard && npm publish
        env:
          NODE_AUTH_TOKEN: ${{ secrets.NPM_TOKEN }}
```

### 13.8 보안 고려사항

| 항목 | 정책 |
|------|------|
| **네트워크 바인딩** | 기본 `localhost`만 바인드. 외부 접근 시 `--host 0.0.0.0` 명시 필요 |
| **인증** | v0.x에서는 없음 (로컬 전용). v1.0+ Docker 배포 시 리버스 프록시(nginx) + Basic Auth 권장 |
| **파일 접근** | 읽기 전용. 대시보드는 절대 프로젝트 파일을 수정하지 않음 |
| **CORS** | 개발 모드에서만 활성화. 프로덕션에서는 same-origin |
| **경로 검증** | `/api/project` POST 시 path traversal 방지 (`..` 차단, 절대 경로만 허용) |
| **Docker 볼륨** | `:ro` (읽기 전용) 마운트 권장 |

### 13.9 모니터링 및 로깅

| 단계 | 로깅 방식 |
|------|----------|
| v0.x | `console.log` (Fastify 기본 로거) |
| v1.0 | Pino (메인 프로젝트와 동일) + 구조화된 JSON 로그 |

**주요 로그 이벤트:**
- 서버 시작/종료, 포트, 프로젝트 경로
- 프로젝트 경로 변경
- 파일 감시 이벤트 (sessions.json 변경 등)
- SSE 클라이언트 연결/해제
- API 에러 (파일 읽기 실패 등)
