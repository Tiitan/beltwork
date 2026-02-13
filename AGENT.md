# AGENT.md

## Project Mission
Build **Beltwork** as a browser-based, cozy automation game to learn React, TypeScript, and Node.js.

Iteration 1 goals:
- Pure web UI (`HTML/CSS`, no canvas)
- No websocket/push updates (state refreshes on page load/manual refresh)
- Event-driven backend (no global game tick loop)
- Offline progress via catch-up on request
- Frictionless start: one-click guest start from login page

## Product Scope (Iteration 1)
Implement only:
- Station main UI
- Create and upgrade buildings
- Basic asteroid mining
- Station inventory list
- Continuous production selection in factories

Out of scope:
- Market and multiplayer economy
- Combat or fail states
- Real-time notifications

## Identity and Authentication (Iteration 1)
- Login page includes a `Start now` button for guest creation.
- Missing/invalid cookie does not auto-create a new game.
- Server sets a cookie with `player_id` (signed, `HttpOnly`, `Secure`, `SameSite=Lax`).
- Player gets an auto-generated display name (example: `Calm Prospector 0421`).
- Game settings allow:
  - set email
  - set password
  - rename display name
- Upgrading from guest to account must not reset progress.

## Architecture Constraints
- Backend executes logic only:
  - On HTTP requests
  - On explicit domain events (e.g. building completed, mining completed)
- Resource/production state is derived by catch-up from timestamps when user reconnects or refreshes.
- Never rely on per-second loops or in-memory ticking simulation.

## Recommended Stack
- Frontend: React + TypeScript + Vite + Tailwind
- Backend: Node.js + TypeScript + Fastify
- Database: PostgreSQL
- ORM: Drizzle ORM (or Prisma if preferred for DX)
- Validation: Zod
- Jobs/events (v1): PostgreSQL-backed event table + lightweight worker process
- Redis: optional; defer until you need queue throughput, caching, or distributed locks
- NestJS: optional; not required for v1. Prefer Fastify for lower ceremony while learning core patterns.

## Engineering Rules
- Keep domain logic deterministic and server-authoritative.
- Store event timestamps in UTC and always compute with server time.
- Make catch-up/idempotent logic safe to run repeatedly.
- Prefer append-only event records for traceability.
- Never trust client-provided `player_id`; read identity from server-validated cookie/session.
- Keep UI simple and legible (lists/cards/forms first, no heavy animation dependency).
- Add tests for economy math and catch-up functions before UI refinements.

## Initial Module Boundaries
- `apps/web`: React UI
- `apps/api`: HTTP API + event processing
- `packages/domain`: shared types and pure simulation functions
- `packages/db`: schema and migrations

## Definition of Done (v1)
- First visit can start instantly via login page `Start now` button.
- Missing cookie lands on login/start screen (no automatic new game creation).
- Player can create station and view inventory.
- Player can queue building construction/upgrade and see completion after refresh.
- Player can assign mining to asteroid and receive resources after elapsed time.
- Player can set factory recipe and receive produced components after elapsed time.
- Player can add email/password and rename in settings without losing station progress.
- All above works after being offline and returning later.

## Non-Goals for v1
- Perfect balancing
- Real-time multiplayer
- Advanced visuals
- Market simulation

## Documentation
Keep these files updated when scope changes:
- `beltwork_game_design_document.md`
- `architecture.md`
- `AGENT.md`
