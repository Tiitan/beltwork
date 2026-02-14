# Database Schema Reference

This document is the human-readable reference for the PostgreSQL schema defined in
`apps/api/src/db/schema.ts`.

## Format and location

- Location: `docs/database.md`
- Format: one section per table with:
  - purpose
  - key relationships and constraints
  - column-by-column reference

## Enums

### `auth_type`

- `guest`: temporary/anonymous account created by `Start now`
- `local`: account with email/password credentials

## Tables

### `players`

Purpose: Player identity profile and authentication mode.

Key constraints:

- Primary key: `id`
- Unique email when present (`email IS NOT NULL`)

| Column          | Type           | Description                                          |
| --------------- | -------------- | ---------------------------------------------------- |
| `id`            | `uuid`         | Player identifier.                                   |
| `display_name`  | `text`         | Player-facing name (renameable).                     |
| `email`         | `text \| null` | Login email for local accounts; nullable for guests. |
| `password_hash` | `text \| null` | Password hash for local accounts; null for guests.   |
| `auth_type`     | `auth_type`    | Identity mode (`guest` or `local`).                  |
| `created_at`    | `timestamptz`  | Creation time (UTC).                                 |
| `updated_at`    | `timestamptz`  | Last profile update time (UTC).                      |

### `stations`

Purpose: Main station aggregate root for simulation and map placement.

Key constraints:

- Primary key: `id`
- Foreign key: `player_id -> players.id`
- One station per player (`player_id` unique)
- Coordinate index: `(x, y)`

| Column              | Type          | Description                                                                       |
| ------------------- | ------------- | --------------------------------------------------------------------------------- |
| `id`                | `uuid`        | Station identifier.                                                               |
| `player_id`         | `uuid`        | Owner player id.                                                                  |
| `x`                 | `integer`     | Station X coordinate on world map.                                                |
| `y`                 | `integer`     | Station Y coordinate on world map.                                                |
| `spawned_at`        | `timestamptz` | Station spawn timestamp.                                                          |
| `last_simulated_at` | `timestamptz` | Station-wide simulation cursor used for catch-up on read/action/event processing. |
| `created_at`        | `timestamptz` | Row creation timestamp.                                                           |
| `updated_at`        | `timestamptz` | Row update timestamp.                                                             |

### `station_buildings`

Purpose: Buildings owned by a station, with upgrade state inferred from
`upgrade_started_at`.

Status inference rule:

- `upgrade_started_at != null`: upgrade in progress
- `upgrade_started_at == null`: no active upgrade running

Key constraints:

- Primary key: `id`
- Foreign key: `station_id -> stations.id`
- Unique per station/type: `(station_id, building_type)`

| Column               | Type                  | Description                           |
| -------------------- | --------------------- | ------------------------------------- |
| `id`                 | `uuid`                | Building row identifier.              |
| `station_id`         | `uuid`                | Owning station id.                    |
| `building_type`      | `text`                | Building type key from game config.   |
| `level`              | `integer`             | Current building level (starts at 1). |
| `upgrade_started_at` | `timestamptz \| null` | Upgrade start timestamp.              |
| `created_at`         | `timestamptz`         | Row creation timestamp.               |
| `updated_at`         | `timestamptz`         | Row update timestamp.                 |

### `station_inventory`

Purpose: Resource amounts held by station, one row per resource key.

Key constraints:

- Primary key: `id`
- Foreign key: `station_id -> stations.id`
- Unique resource row per station: `(station_id, resource_key)`
- Non-negative amount check (`amount >= 0`)

| Column         | Type            | Description                                         |
| -------------- | --------------- | --------------------------------------------------- |
| `id`           | `uuid`          | Inventory row identifier.                           |
| `station_id`   | `uuid`          | Owning station id.                                  |
| `resource_key` | `text`          | Resource key from config (e.g. metals, components). |
| `amount`       | `numeric(20,4)` | Resource quantity using fixed precision.            |
| `created_at`   | `timestamptz`   | Row creation timestamp.                             |
| `updated_at`   | `timestamptz`   | Row update timestamp.                               |

### `asteroid`

Purpose: Runtime world asteroid instances with coordinates and depletion state.

Key constraints:

- Primary key: `id`
- Indexed for discovery/filtering: `(is_depleted, template_id)` and `(x, y)`
- Non-negative units check (`remaining_units >= 0`)

| Column            | Type          | Description                                          |
| ----------------- | ------------- | ---------------------------------------------------- |
| `id`              | `uuid`        | Asteroid instance identifier.                        |
| `template_id`     | `text`        | Template key from asteroid config.                   |
| `x`               | `integer`     | Asteroid X coordinate.                               |
| `y`               | `integer`     | Asteroid Y coordinate.                               |
| `remaining_units` | `integer`     | Remaining extractable units.                         |
| `seed`            | `text`        | Seed used for deterministic generation/distribution. |
| `spawned_at`      | `timestamptz` | Spawn timestamp.                                     |
| `is_depleted`     | `boolean`     | No further extraction should occur (soft delete)     |
| `created_at`      | `timestamptz` | Row creation timestamp.                              |
| `updated_at`      | `timestamptz` | Row update timestamp.                                |

### `mining_operations`

Purpose: Track mining runs from station to asteroid and catch-up processing state.

Lifecycle rule:

- Open operation: `completed_at IS NULL`
- Closed operation: `completed_at IS NOT NULL`

Key constraints:

- Primary key: `id`
- Foreign keys:
  - `station_id -> stations.id`
  - `asteroid_id -> asteroid.id`
- Open-operation/terminal timestamp index: `(station_id, completed_at)`
- Completed index: `(completed_at)`
- Due-time index: `(due_at)`
- One open operation per asteroid: unique `(asteroid_id)` where `completed_at IS NULL`
- Unique idempotency key when present

| Column                | Type                  | Description                                  |
| --------------------- | --------------------- | -------------------------------------------- |
| `id`                  | `uuid`                | Mining operation identifier.                 |
| `station_id`          | `uuid`                | Owning station id.                           |
| `asteroid_id`         | `uuid`                | Target asteroid id.                          |
| `started_at`          | `timestamptz`         | Start timestamp.                             |
| `completed_at`        | `timestamptz \| null` | Terminal timestamp (!=null: soft delete)     |
| `due_at`              | `timestamptz \| null` | Next due time for scheduled progression.     |
| `rig_power`           | `integer`             | Effective rig strength multiplier input.     |
| `distance_multiplier` | `numeric(12,6)`       | Runtime distance-based production modifier.  |
| `idempotency_key`     | `text \| null`        | Optional dedupe key for retry-safe commands. |
| `created_at`          | `timestamptz`         | Row creation timestamp.                      |
| `updated_at`          | `timestamptz`         | Row update timestamp.                        |

### `factory_jobs`

Purpose: Continuous production state for station factories.

Lifecycle rule:

- Open job: `completed_at IS NULL`
- Closed job: `completed_at IS NOT NULL`
- No pause state: jobs either continue, get canceled, or auto-close on completion/insufficient conditions

Key constraints:

- Primary key: `id`
- Foreign keys:
  - `station_id -> stations.id`
  - `factory_building_id -> station_buildings.id` (nullable)
- Station/completion index: `(station_id, completed_at)`
- Completed index: `(completed_at)`
- Due-time index: `(due_at)`
- Unique idempotency key when present

| Column                | Type                  | Description                                                         |
| --------------------- | --------------------- | ------------------------------------------------------------------- |
| `id`                  | `uuid`                | Factory job identifier.                                             |
| `station_id`          | `uuid`                | Owning station id.                                                  |
| `factory_building_id` | `uuid \| null`        | Optional specific building executing the job.                       |
| `recipe_key`          | `text \| null`        | Selected recipe key.                                                |
| `selected_at`         | `timestamptz`         | Time recipe was selected/started.                                   |
| `due_at`              | `timestamptz \| null` | Next due time for production completion/event.                      |
| `cycles_completed`    | `integer`             | Count of completed production cycles.                               |
| `target_cycles`       | `integer \| null`     | Queue stop target in cycles; `null` means infinite production.      |
| `completed_at`        | `timestamptz \| null` | Terminal timestamp for canceled/finished jobs; `null` means active. |
| `idempotency_key`     | `text \| null`        | Optional dedupe key for retry-safe commands.                        |
| `created_at`          | `timestamptz`         | Row creation timestamp.                                             |
| `updated_at`          | `timestamptz`         | Row update timestamp.                                               |

### `domain_events`

Purpose: Append-only scheduled/processed domain events for worker and catch-up flows.

Key constraints:

- Primary key: `id`
- Foreign key: `station_id -> stations.id` (nullable)
- Worker lookup index: `(due_at, processed_at)`
- Unique idempotency key

| Column            | Type                  | Description                                         |
| ----------------- | --------------------- | --------------------------------------------------- |
| `id`              | `uuid`                | Event row identifier.                               |
| `station_id`      | `uuid \| null`        | Related station; nullable for global/system events. |
| `event_type`      | `text`                | Event name (e.g. `mining.completed`).               |
| `payload_json`    | `jsonb`               | Event payload document.                             |
| `idempotency_key` | `text`                | Dedupe key to keep event handling retry-safe.       |
| `due_at`          | `timestamptz`         | When event becomes eligible for processing.         |
| `processed_at`    | `timestamptz \| null` | Processing completion timestamp.                    |
| `created_at`      | `timestamptz`         | Event creation timestamp.                           |

### `simulation_locks`

Purpose: Optional explicit station-level lock rows for simulation/worker coordination.

Key constraints:

- Primary key and foreign key: `station_id -> stations.id`

| Column       | Type          | Description                                   |
| ------------ | ------------- | --------------------------------------------- |
| `station_id` | `uuid`        | Locked station id (one lock row per station). |
| `locked_by`  | `text`        | Lock owner identifier (process/worker id).    |
| `locked_at`  | `timestamptz` | Lock acquisition timestamp.                   |
| `expires_at` | `timestamptz` | Lock expiry timestamp.                        |

### `sessions`

Purpose: Server-side session tracking for signed cookie or opaque token flow.

Key constraints:

- Primary key: `id`
- Foreign key: `player_id -> players.id`
- Unique session token
- Session lookup indexes on player and expiry/revocation state

| Column          | Type                  | Description                                       |
| --------------- | --------------------- | ------------------------------------------------- |
| `id`            | `uuid`                | Session identifier.                               |
| `player_id`     | `uuid`                | Session owner player id.                          |
| `session_token` | `text`                | Opaque token value (must be unique).              |
| `created_at`    | `timestamptz`         | Session creation timestamp.                       |
| `expires_at`    | `timestamptz`         | Session expiration timestamp.                     |
| `revoked_at`    | `timestamptz \| null` | Revocation timestamp when session is invalidated. |
| `last_seen_at`  | `timestamptz \| null` | Last observed activity timestamp.                 |
