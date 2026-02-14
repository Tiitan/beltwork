# Route Reference

This document summarizes Beltwork API routes using:

- `architecture.md`
- `docs/database.md`
- `beltwork_game_design_document.md`
- current implementation in `apps/api/src/server.ts`

## Status Key

- `Implemented`: route exists in `apps/api/src/server.ts` today.
- `Planned (v1)`: route is defined in architecture but not implemented yet.

## Implemented Routes (Current API)

## Observability and Auth

| Method | Path          | Status              | Purpose                        | Validation | Storage/Domain                                           |
| ------ | ------------- | ------------------- | ------------------------------ | ---------- | -------------------------------------------------------- |
| `GET`  | `/ready`      | Implemented         | Readiness probe with DB check. | None       | Calls DB connectivity check (`checkDatabaseConnection`). |
| `GET`  | `/live`       | Implemented         | Simple liveness probe.         | None       | No DB write.                                             |
| `POST` | `/auth/login` | Implemented (draft) | Placeholder login endpoint.    | None       | Returns static draft payload.                            |

## Factory Jobs

| Method | Path                              | Status      | Purpose                                                   | Validation                                                           | Storage/Domain                                                                                   |
| ------ | --------------------------------- | ----------- | --------------------------------------------------------- | -------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| `POST` | `/v1/factories/:id/select-recipe` | Implemented | Start/select a factory recipe for a factory id.           | `params`: `{ id: string(min 1) }`; `body`: `selectRecipeInputSchema` | Creates in-memory `FactoryJob`, emits `factory.recipe.selected` in response payload.             |
| `POST` | `/v1/factories/:id/catch-up`      | Implemented | Run elapsed-time production catch-up for one factory job. | `params`: `{ id: string(min 1) }`; `body`: `catchUpInputSchema`      | Updates in-memory `FactoryJob`, may emit `inventory.changed` and `factory.production.completed`. |
| `POST` | `/v1/factories/:id/clear-recipe`  | Implemented | Stop/clear currently selected recipe.                     | `params`: `{ id: string(min 1) }`                                    | Marks in-memory job as cleared/completed.                                                        |
| `GET`  | `/v1/factories/:id`               | Implemented | Read current factory job state.                           | `params`: `{ id: string(min 1) }`                                    | Reads in-memory `FactoryJob`.                                                                    |

### Implemented Zod Schemas

From `apps/api/src/factory-jobs/service.ts`:

- `selectRecipeInputSchema`
  - `recipe_key: string` (required, non-empty)
  - `is_infinite: boolean` (required)
  - `target_cycles: int > 0` (optional)
  - rule: when `is_infinite = false`, `target_cycles` is required
- `catchUpInputSchema`
  - `elapsed_seconds: int >= 0`
  - `available_input_cycles: int >= 0`
  - `output_capacity_cycles: int >= 0`
  - `cycle_duration_seconds: int > 0` (default `60`)

### Current Gap vs Target Architecture

- Current factory routes keep job state in process memory (`Map<string, FactoryJob>`), so state is not persisted across API restarts.
- Target architecture expects persistence and catch-up from PostgreSQL tables such as `factory_jobs`, `station_inventory`, and `domain_events`.

## Planned Routes (v1 Architecture)

These routes are specified in `architecture.md` and aligned with the game loop from `beltwork_game_design_document.md`.

## Session and Identity

| Method | Path                    | Status       | Game-loop Intent                        | Main DB Tables                    |
| ------ | ----------------------- | ------------ | --------------------------------------- | --------------------------------- |
| `GET`  | `/v1/session/bootstrap` | Planned (v1) | Restore player and station on app open. | `sessions`, `players`, `stations` |
| `POST` | `/v1/session/start-now` | Planned (v1) | Guest-first instant start flow.         | `players`, `stations`, `sessions` |

## Settings

| Method  | Path                   | Status       | Game-loop Intent                            | Main DB Tables |
| ------- | ---------------------- | ------------ | ------------------------------------------- | -------------- |
| `PATCH` | `/v1/settings/profile` | Planned (v1) | Rename player profile identity.             | `players`      |
| `POST`  | `/v1/settings/account` | Planned (v1) | Upgrade guest account to local credentials. | `players`      |

## Station and Map

| Method | Path          | Status       | Game-loop Intent                                           | Main DB Tables                                                                                             |
| ------ | ------------- | ------------ | ---------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| `GET`  | `/v1/station` | Planned (v1) | Return authoritative station snapshot with catch-up.       | `stations`, `station_buildings`, `station_inventory`, `factory_jobs`, `mining_operations`, `domain_events` |
| `GET`  | `/v1/map`     | Planned (v1) | Return station position and discovered asteroid instances. | `stations`, `asteroid`                                                                                     |

## Buildings and Mining

| Method | Path                          | Status       | Game-loop Intent                             | Main DB Tables                                            |
| ------ | ----------------------------- | ------------ | -------------------------------------------- | --------------------------------------------------------- |
| `POST` | `/v1/buildings/:type/create`  | Planned (v1) | Expand station capabilities.                 | `station_buildings`, `domain_events`, `station_inventory` |
| `POST` | `/v1/buildings/:type/upgrade` | Planned (v1) | Improve building throughput/efficiency.      | `station_buildings`, `domain_events`, `station_inventory` |
| `POST` | `/v1/mining/start`            | Planned (v1) | Start extraction from selected asteroid.     | `mining_operations`, `asteroid`, `domain_events`          |
| `POST` | `/v1/mining/stop`             | Planned (v1) | Stop current mining run safely/idempotently. | `mining_operations`, `domain_events`                      |

## Factory (Planned Surface)

| Method | Path                              | Status                                             | Game-loop Intent                          | Main DB Tables                                       |
| ------ | --------------------------------- | -------------------------------------------------- | ----------------------------------------- | ---------------------------------------------------- |
| `POST` | `/v1/factories/:id/select-recipe` | Implemented now; Planned persisted behavior for v1 | Select production recipe in factory loop. | `factory_jobs`, `station_inventory`, `domain_events` |
| `POST` | `/v1/factories/:id/clear-recipe`  | Implemented now; Planned persisted behavior for v1 | Stop current factory production.          | `factory_jobs`, `domain_events`                      |

## Domain Events and Catch-Up Contract

Per architecture, mutating endpoints should:

- validate payloads with Zod
- apply command and simulation catch-up transactionally
- append idempotent `domain_events`
- return updated read model snapshot

Relevant event types for routes:

- `building.upgrade.started`
- `building.upgrade.completed`
- `mining.started`
- `mining.completed`
- `factory.recipe.selected`
- `factory.production.completed`
- `inventory.changed`
