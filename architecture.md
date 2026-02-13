# Beltwork Architecture (Iteration 1)

## 1. Goals and Constraints

### Goals
- Learn by building with React, TypeScript, Node, and PostgreSQL.
- Deliver a playable vertical slice with offline progress.
- Keep backend simulation event-driven and deterministic.

### Hard Constraints
- Pure web UI (`HTML/CSS`), no canvas.
- No websocket/push updates.
- Backend runs simulation only on request or scheduled domain events.
- State catches up from persisted timestamps.
- Player can start instantly without signup via explicit `Start now` action.
- Shared global map with runtime station/asteroid positions.

## 2. Stack Recommendation

### Chosen for v1
- Frontend: `React + TypeScript + Vite + Tailwind`
- Backend: `Node.js + TypeScript + Fastify`
- DB: `PostgreSQL`
- ORM: `Drizzle ORM`
- Validation: `Zod`

### Why not NestJS for v1
NestJS is good for larger teams and strict structure, but adds abstraction overhead during early learning. Fastify keeps HTTP and domain flow explicit, which better fits this learning-first iteration.

### Redis decision
Do not require Redis in v1. Add it only if needed for:
- high-volume job queues
- caching hot read models
- distributed locking across workers

For v1, PostgreSQL can store both game state and event queue.

## 3. High-Level System Design

### Runtime Components
- `web` (React SPA)
- `api` (Fastify server)
- `worker` (Node process polling due events from PostgreSQL)
- `postgres`

### Interaction Model
1. Player opens/refreshes page.
2. API authenticates player, loads station aggregate.
3. API runs catch-up simulation from `last_simulated_at` to `now`.
4. API applies due domain events (building completion, mining completion, production completion).
5. API persists updates transactionally.
6. API returns read model to frontend.

No component runs a global tick.

## 3.1 Guest-First Identity Flow

### First Visit
1. Browser calls `GET /v1/session/bootstrap`.
2. If no valid auth cookie exists, API returns `unauthenticated` state.
3. Login page shows `Start now` button.
4. Browser calls `POST /v1/session/start-now`.
5. API creates guest `Player` + starter `Station`, sets signed cookie, returns profile with generated display name.

### Returning Visit
- API resolves player from cookie and serves station snapshot.
- If cookie is missing/invalid, API returns `unauthenticated` (no auto-create).

### Settings Upgrade
- Guest can add email/password later in settings.
- Identity links to same `player_id`; no progress migration required.
- Player can rename display name.

## 4. Event-Driven Domain Model

### Core Domain Entities
- `Player`
- `Station`
- `Building` (type, level, upgrade state)
- `Asteroid`
- `MiningOperation`
- `FactoryJob`
- `Inventory`
- `DomainEvent`

`Station` map fields for v1 contract:
- `x`
- `y`
- `spawned_at`

`Asteroid` fields for v1 contract:
- `id`
- `template_id`
- `x`
- `y`
- `remaining_units`
- `seed`
- `spawned_at`
- `is_depleted`

`Player` fields for v1:
- `id`
- `display_name`
- `email` (nullable, unique when present)
- `password_hash` (nullable for guest players)
- `auth_type` (`guest` | `local`)

### Event Types (v1)
- `building.upgrade.started`
- `building.upgrade.completed`
- `mining.started`
- `mining.completed`
- `factory.recipe.selected`
- `factory.production.completed`
- `inventory.changed`

### Event Processing Rule
- Events are append-only records.
- Processing is idempotent via `processed_at` and idempotency keys.
- Catch-up can safely re-check overdue events.

### Scanner Semantics (v1)
- `asteroid_list_size`: maximum count of asteroid instances returned by discovery query.
- `rare_asteroid_chance`: query-time bonus weighting for rare template inclusion.
- With one-time world spawn, scanner stats do not change spawn population.

## 5. Catch-Up Simulation Strategy

### Principle
Compute elapsed time from persisted timestamps when player hits API.

### Per-system behavior
- Building upgrades: if completion time <= now, apply level increase and finalize.
- Mining: award output proportional to elapsed duration, rig parameters, and runtime station-to-asteroid distance.
- Factory production: consume inputs and create outputs for elapsed cycles.

### Safety
- Always execute catch-up inside DB transaction.
- Clamp negative durations to zero.
- Use integer/fixed precision math for resources.

## 6. Persistence Model (PostgreSQL)

### Tables (minimum)
- `players`
- `stations`
- `station_buildings`
- `station_inventory`
- `asteroid`
- `mining_operations`
- `factory_jobs`
- `domain_events`
- `simulation_locks` (optional; can use row lock on station)
- `player_sessions` (if using server-side session IDs in cookie)

### Key columns
- time fields: `created_at`, `updated_at`, `last_simulated_at`, `due_at`, `processed_at`
- event fields: `event_type`, `payload_json`, `idempotency_key`
- identity fields: `display_name`, `email`, `password_hash`, `auth_type`
- map fields: `x`, `y`, `spawned_at`, `template_id`, `remaining_units`, `is_depleted`

### Indexes
- `domain_events (due_at, processed_at)`
- `mining_operations (station_id, status)`
- `factory_jobs (station_id, status)`
- `station_inventory (station_id, resource_key)` unique
- `players (email)` unique where email is not null
- `asteroid (is_depleted, template_id)`
- `asteroid (x, y)`

## 6.1 Map and Distance Contract

- Coordinate system: 2D cartesian (`map.v1.json`).
- Runtime distance formula:
  - `distance_units = sqrt((asteroid_x - station_x)^2 + (asteroid_y - station_y)^2)`
- Mining travel multiplier uses runtime distance from asteroid position.
- Distance safety clamp for near-zero values:
  - `effective_distance_units = max(distance_units, minimum_distance_units)`

Spawn policy contract for v1:
- Shared global map.
- Asteroid templates are static config entries.
- World asteroid instances are runtime spawned entities with positions.
- Spawn is one-time world initialization for now (no auto-refill on depletion).

## 7. API Surface (v1)

### Session/Identity
- `GET /v1/session/bootstrap`
  - resolves cookie session
  - returns either authenticated profile or `unauthenticated`
- `POST /v1/session/start-now`
  - creates guest player + station
  - sets cookie
  - returns player profile + minimal station summary

### Settings
- `PATCH /v1/settings/profile`
  - rename display name
- `POST /v1/settings/account`
  - set email/password to upgrade guest to local account

### Station
- `GET /v1/station`
  - runs catch-up, returns full station read model
  - includes station position and discovered asteroid instances

### Map
- `GET /v1/map`
  - returns station position `{x,y}` for current player station
  - returns discovered asteroid instances:
    - `{id, template_id, x, y, distance_from_station, remaining_units, is_depleted}`
  - never returns template static distance (none exists in config)

### Buildings
- `POST /v1/buildings/:type/create`
- `POST /v1/buildings/:type/upgrade`

### Mining
- `POST /v1/mining/start`
- `POST /v1/mining/stop`

### Factories
- `POST /v1/factories/:id/select-recipe`
- `POST /v1/factories/:id/clear-recipe`

All mutating endpoints:
- validate input with Zod
- execute domain command + append event(s)
- return updated summary snapshot

## 8. Frontend Architecture

### Views
- Station overview page (single page for v1)
  - building list + upgrade actions
  - inventory list
  - mining operations panel
  - factory recipe selection panel

### State Strategy
- `react-query` for server state
- one `GET /v1/station` query as primary source of truth
- mutations invalidate/refetch station query
- manual refresh button supported

### UX for no push updates
- Show “Last updated at” timestamp
- Show countdown estimates computed client-side from server timestamps
- Require refresh or action to observe authoritative updates
- Show map coordinates and computed distance-to-target in mining panel.

## 9. Worker/Event Execution

### Worker loop (event-driven, not game tick)
- Poll every few seconds for due, unprocessed events.
- Claim events with `FOR UPDATE SKIP LOCKED`.
- Apply domain handler transactionally.
- Mark events processed.

This is infrastructure polling, not simulation ticking. Simulation still depends on explicit due events and request catch-up.

## 10. Concurrency and Integrity

- Lock station row during command + catch-up.
- Use optimistic version or `updated_at` checks for conflicting writes.
- Every command must be idempotent for retries.
- Prevent double spend by consuming inventory in one transaction.
- For settings updates, enforce email uniqueness transactionally.

## 10.1 Auth and Cookie Security

- Cookie should be `HttpOnly`, `Secure`, `SameSite=Lax`.
- Cookie payload must be signed (or use opaque session ID).
- Never accept `player_id` from query/body.
- Passwords stored as strong hash (Argon2id recommended).
- Rate-limit account creation and password-setting endpoints.

## 11. Suggested Monorepo Layout

```txt
beltwork/
  apps/
    web/
    api/
    worker/
  packages/
    domain/
    db/
    shared/
  docs/
    architecture.md (optional move later)
```

For now, keep `architecture.md` at repo root as requested.

## 12. Implementation Plan (First Build Steps)

1. Bootstrap monorepo + tooling (pnpm workspaces, TS config, lint).
2. Create PostgreSQL schema + migrations.
3. Implement domain simulation functions in `packages/domain`.
4. Implement `GET /v1/station` with catch-up transaction.
5. Add building upgrade endpoints/events.
6. Add mining start/resolve endpoints/events.
7. Add factory recipe + production resolution.
8. Build station UI in React + Tailwind.
9. Add integration tests for catch-up and idempotency.

## 13. Testing Strategy

- Unit tests: resource math, production cycles, upgrade timers.
- Integration tests: API command -> DB state -> catch-up correctness.
- Replay test: apply same event twice; state must not duplicate rewards.
- Config tests:
  - `asteroids.v1.json` contains no `distance_au`.
  - every asteroid template has `spawn_weight > 0`.
  - every asteroid template `composition` sums to 1.0 within epsilon.
  - `map.v1.json` bounds and spawn constraints are valid.
- Domain tests:
  - distance formula correctness from station and asteroid coordinates.
  - mining travel multiplier uses runtime `distance_units`.
  - weighted template selection deterministic with fixed RNG seed.
- API contract tests:
  - station payload includes station `{x,y}`.
  - map payload asteroid entries include `{id, template_id, x, y, distance_from_station}`.
  - responses include no template static distance field.

## 14. Risks and Mitigations

- Risk: time-based bugs from inconsistent timestamps.
  - Mitigation: use UTC everywhere; server-generated times only.
- Risk: duplicate processing on retries.
  - Mitigation: idempotency keys + processed markers + unique constraints.
- Risk: race conditions with multiple requests.
  - Mitigation: row locks and transactional command handlers.

## 15. v1 Acceptance Criteria

- New player can start without signup from login page `Start now` button.
- Returning player resumes via cookie identity.
- Missing/invalid cookie does not auto-create a new game.
- Guest can set email/password later without losing progress.
- Player can rename from settings.
- Asteroids are selected from template rarity (`spawn_weight`) and represented as runtime positioned instances.
- Template config contains no static asteroid distance.
- Station and asteroid map positions are represented in API contracts.
- Refresh after time passes and station correctly catches up.
- Building upgrades complete without live connection.
- Mining yields resources after elapsed time.
- Factories produce continuously from selected recipe and available inputs.
- No websocket or global tick required.
