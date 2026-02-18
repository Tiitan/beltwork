# Beltwork

Monorepo for the Beltwork web client and API.

## Stack

- Frontend: React, TypeScript, Vite, Tailwind
- Backend: Fastify, TypeScript
- Database: PostgreSQL
- ORM: Drizzle
- Tests: Vitest
- Containers: Docker, Docker Compose

## Project structure

- `apps/web`: React app
- `apps/api`: Fastify API
- `gameconfig`: game data/configuration files

## Prerequisites

- Node.js 20+
- npm 10+
- Docker Desktop (optional, for containerized Postgres/API)

## Install

```bash
npm install
```

## Run locally

App env files:

- API: copy `apps/api/.env.example` to `apps/api/.env`
- Web: copy `apps/web/.env.example` to `apps/web/.env`

Start API:

```bash
npm run dev:api
```

Start web app:

```bash
npm run dev:web
```

## Quality guardrails

Check formatting:

```bash
npm run format:check
```

Format files:

```bash
npm run format
```

Lint/typecheck:

```bash
npm run lint
npm run typecheck
```

Run all checks:

```bash
npm run check
```

Pre-commit hook:

- Husky + lint-staged are configured.
- On commit, staged files are auto-formatted with Prettier.

## Test

```bash
npm test
```

## Database & Drizzle

Use `apps/api/.env.example` as template for local API env values.

Schema reference:

- `docs/database.md`

Generate migrations:

```bash
npm run db:generate
```

Apply migrations:

```bash
npm run db:migrate
```

## Observability routes

- `GET /live`: process liveness probe, returns `200` with `{ "status": "ok" }`
- `GET /ready`: readiness probe, checks PostgreSQL connectivity (`select 1`)
  - returns `200` with `{ "status": "ready" }` when DB is reachable
  - returns `503` with `{ "status": "not_ready" }` when DB is not reachable

## Docker

Build and run API + Postgres:

```bash
docker compose up --build api postgres
```

Stop containers:

```bash
docker compose down
```

## Asset scripts env

Root `/.env.example` now contains only root tooling variables used by asset generation scripts in `scripts/`.
