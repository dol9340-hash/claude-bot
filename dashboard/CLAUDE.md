# Dashboard CLAUDE.md

Fastify 5 서버 + React 19 SPA (Vite + Tailwind CSS 4) 풀스택 웹 앱.

## Build & Dev Commands

```bash
npm run dev:server    # Fastify server only (tsx watch)
npm run dev:client    # Vite client only
npm run build:client  # Vite production build
npm run build:server  # tsc server build (tsconfig.server.json)
```

## Entry Points

- Server: `src/server/index.ts` → Fastify 앱 + WebSocket + 8개 REST route
- Client: `src/client/main.tsx` → React SPA (App.tsx → 7개 pages)
- Shared: `src/shared/` — DTO 타입만, 로직 없음. 서버/클라이언트 양쪽에서 import.

## TypeScript Config

2개의 tsconfig:
- `tsconfig.json` — Client: JSX react-jsx, bundler resolution, `@shared/*` → `src/shared/*`
- `tsconfig.server.json` — Server: Node16 module, `src/server/` → `dist/`

## Path Alias

- 클라이언트에서 shared 타입 import 시 반드시 `@shared/*` alias 사용.
- 상대 경로(`../../shared/`)로 import 하지 않는다.

## Ports

- Fastify: 3001 (env `PORT`로 오버라이드 가능)
- Vite dev: 5173

## Sub-module CLAUDE.md

- `src/server/CLAUDE.md` — 서버 라우트, 서비스, 통신 프로토콜
- `src/client/CLAUDE.md` — React 패턴, hooks, 컴포넌트 구조
