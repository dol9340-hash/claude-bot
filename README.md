# ClaudeBot

대화 기반 개발 오케스트레이터 — 5-Phase 워크플로우로 프로젝트를 관리하는 웹 대시보드.

## 빠른 시작

### 요구 사항

- Node.js 18+
- Anthropic API 키 (`ANTHROPIC_API_KEY` 환경 변수)

### 설치 및 실행

```bash
# 의존성 설치
npm install
cd dashboard && npm install && cd ..

# 개발 모드 (Fastify 3001 + Vite 5173)
npm run dev

# 또는 Windows
run.bat
```

브라우저에서 `http://localhost:5173` 을 열어 대시보드에 접속합니다.

### 프로덕션

```bash
npm run build
npm start
```

## 워크플로우

ClaudeBot은 5단계 워크플로우를 통해 프로젝트 개발을 진행합니다:

```text
idle → onboarding → prediction → documentation → development → review → completed
```

1. **Onboarding** — 자유 대화로 프로젝트 목표 파악. "다음" 또는 "next"로 진행.
2. **Prediction** — Output Preview HTML 생성. 사용자 승인/수정/거부.
3. **Documentation** — PRD, TechSpec, Tasks 문서 자동 생성. 탭 형태 미리보기.
4. **Development** — Bot Team (developer + reviewer) 구성, Agent SDK로 코드 실행.
5. **Review** — 결과 보고서 생성, 목표 달성도 확인.

완료 후 **Epic Cycle**로 다음 작업을 자동/수동 선택하여 연속 실행할 수 있습니다.

## 프로젝트 설정

대상 프로젝트 루트에 `claudebot.config.json`을 생성합니다:

```json
{
  "model": "claude-sonnet-4-6",
  "permissionMode": "acceptEdits",
  "maxTotalBudgetUsd": 5.0,
  "maxBudgetPerTaskUsd": 1.0,
  "taskTimeoutMs": 600000,
  "logLevel": "info",
  "autoOnboarding": false
}
```

모든 필드는 선택적이며 기본값이 적용됩니다. 상세 옵션은 [docs/Config.md](docs/Config.md)를 참조하세요.

## 프로젝트 구조

```text
src/                          # 공유 백엔드 코어
├── index.ts                  # Dashboard 런처
├── config.ts                 # Zod 설정 로더
├── types.ts                  # 코어 타입
└── engine/
    ├── sdk-executor.ts       # Agent SDK 실행기
    └── types.ts              # IExecutor 인터페이스

dashboard/                    # 풀스택 웹 앱
├── src/server/               # Fastify 5 서버
│   ├── index.ts              # 서버 진입점 + AppState
│   ├── routes/               # REST + WebSocket 라우트
│   └── services/             # 핵심 서비스
│       ├── chat-manager.ts   # 채팅 + WebSocket + 영속화
│       ├── workflow-engine.ts# 5-Phase 상태 머신
│       ├── bot-composer.ts   # 봇 팀 구성 + 실행
│       ├── message-queue.ts  # 우선순위 메시지 큐
│       ├── session-manager.ts# 세션 기록 + 예산 추적
│       └── html-preview.ts   # HTML 프리뷰 템플릿
├── src/client/               # React 19 SPA
│   ├── pages/                # ChatPage, DashboardPage, etc.
│   └── components/           # UI 컴포넌트
└── src/shared/               # 서버-클라이언트 공유 타입

docs/                         # 프로젝트 문서
tests/                        # Vitest 테스트
```

## 데이터 저장

대상 프로젝트의 `.claudebot/` 디렉토리에 파일 기반으로 저장합니다:

| 파일 | 내용 |
| --- | --- |
| `chat.json` | 워크플로우 상태 + 채팅 이력 |
| `sessions.json` | 봇 실행 기록 + 비용 누적 |
| `archive/` | 자동 아카이브된 오래된 메시지 |

## 명령어

| 명령어 | 설명 |
| --- | --- |
| `npm run dev` | 개발 서버 (Fastify + Vite) |
| `npm run build` | 전체 빌드 |
| `npm start` | 프로덕션 실행 |
| `npm run typecheck` | 타입 체크 (root + dashboard) |
| `npm test` | Vitest 테스트 실행 |
| `npm run test:watch` | 테스트 워치 모드 |

## API

### REST 엔드포인트

| 메서드 | 경로 | 설명 |
|--------|------|------|
| GET | `/api/chat/messages` | 채팅 이력 (페이징: `?limit=50&offset=0`) |
| GET | `/api/chat/workflow` | 워크플로우 상태 |
| POST | `/api/chat/send` | 사용자 메시지 전송 |
| POST | `/api/chat/decision` | Decision Card 응답 |
| POST | `/api/chat/reset` | 워크플로우 초기화 |
| POST | `/api/chat/autopilot` | Auto-Pilot 토글 |
| GET | `/api/chat/bots` | 봇 상태 조회 |
| POST | `/api/project` | 프로젝트 경로 설정 |

### WebSocket

`ws://localhost:3001/api/chat/ws` — 실시간 채팅, 워크플로우 상태, 봇 상태 브로드캐스트.

## 라이선스

MIT
