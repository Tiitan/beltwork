# Database Schema Reference

This document describes the current PostgreSQL schema implemented in
`apps/api/src/db/schema.ts` and migrations in `apps/api/drizzle/*`.

## Migration Notes (Station Layout)

- `0004_stormy_mimic.sql` introduced `stations.building_layout` (`jsonb`) during the temporary
  station-slot layout phase.
- `0005_lumpy_lilandra.sql` migrated slot ownership to `station_buildings.slot_index`, enforced
  slot constraints, and dropped `stations.building_layout`.

Current source of truth: slot position is persisted on each building row via
`station_buildings.slot_index`.

## Enums

### `auth_type`

- `guest`: temporary account created with Start now
- `local`: account with email/password
- `google`: account linked/authenticated through Google

## Tables

### `players`

Purpose: player profile and auth mode.

Key constraints:

- Primary key: `id`
- Unique email when present (`email IS NOT NULL`)

| Column          | Type           | Description                      |
| --------------- | -------------- | -------------------------------- |
| `id`            | `uuid`         | Player id.                       |
| `display_name`  | `text`         | Display name.                    |
| `email`         | `text \| null` | Email for local/google accounts. |
| `password_hash` | `text \| null` | Password hash for local auth.    |
| `auth_type`     | `auth_type`    | `guest`, `local`, or `google`.   |
| `created_at`    | `timestamptz`  | Creation timestamp.              |
| `updated_at`    | `timestamptz`  | Last update timestamp.           |

### `player_identities`

Purpose: provider identity mapping (currently Google).

Key constraints:

- Primary key: `id`
- Foreign key: `player_id -> players.id`
- Unique provider identity: `(provider, provider_user_id)`

| Column             | Type           | Description                      |
| ------------------ | -------------- | -------------------------------- |
| `id`               | `uuid`         | Mapping id.                      |
| `player_id`        | `uuid`         | Linked player id.                |
| `provider`         | `text`         | Provider key (`google`).         |
| `provider_user_id` | `text`         | Stable provider user id (`sub`). |
| `email`            | `text \| null` | Last known provider email.       |
| `created_at`       | `timestamptz`  | Creation timestamp.              |
| `updated_at`       | `timestamptz`  | Last update timestamp.           |

### `stations`

Purpose: station aggregate root and world coordinates.

Key constraints:

- Primary key: `id`
- Foreign key: `player_id -> players.id`
- One station per player: unique `(player_id)`
- Coordinate index: `(x, y)`

| Column              | Type          | Description            |
| ------------------- | ------------- | ---------------------- |
| `id`                | `uuid`        | Station id.            |
| `player_id`         | `uuid`        | Owner player id.       |
| `x`                 | `integer`     | World X coordinate.    |
| `y`                 | `integer`     | World Y coordinate.    |
| `spawned_at`        | `timestamptz` | Spawn timestamp.       |
| `last_simulated_at` | `timestamptz` | Simulation cursor.     |
| `created_at`        | `timestamptz` | Creation timestamp.    |
| `updated_at`        | `timestamptz` | Last update timestamp. |

Note: `stations` no longer stores building placement (`building_layout` removed in `0005`).

### `station_buildings`

Purpose: buildings attached to a station.

Status inference:

- `upgrade_started_at IS NULL` -> `idle`
- `upgrade_started_at IS NOT NULL` -> `upgrading`

Key constraints:

- Primary key: `id`
- Foreign key: `station_id -> stations.id`
- Unique slot per station: `(station_id, slot_index)`
- Unique type per station: `(station_id, building_type)`
- Slot range check: `slot_index BETWEEN 1 AND 10`

| Column               | Type                  | Description                    |
| -------------------- | --------------------- | ------------------------------ |
| `id`                 | `uuid`                | Building row id.               |
| `station_id`         | `uuid`                | Owning station id.             |
| `slot_index`         | `integer`             | Occupied station slot (1..10). |
| `building_type`      | `text`                | Building type key.             |
| `level`              | `integer`             | Building level.                |
| `upgrade_started_at` | `timestamptz \| null` | Upgrade start timestamp.       |
| `created_at`         | `timestamptz`         | Creation timestamp.            |
| `updated_at`         | `timestamptz`         | Last update timestamp.         |

### `station_inventory`

Purpose: per-station inventory balances.

Key constraints:

- Primary key: `id`
- Foreign key: `station_id -> stations.id`
- Unique per resource per station: `(station_id, resource_key)`
- Non-negative amount check: `amount >= 0`

| Column         | Type            | Description            |
| -------------- | --------------- | ---------------------- |
| `id`           | `uuid`          | Inventory row id.      |
| `station_id`   | `uuid`          | Owning station id.     |
| `resource_key` | `text`          | Resource key.          |
| `amount`       | `numeric(20,4)` | Quantity.              |
| `created_at`   | `timestamptz`   | Creation timestamp.    |
| `updated_at`   | `timestamptz`   | Last update timestamp. |

### `asteroid`

Purpose: runtime asteroid entities in world space.

Key constraints:

- Primary key: `id`
- Indexes: `(is_depleted, template_id)`, `(x, y)`
- Non-negative units check: `remaining_units >= 0`

| Column            | Type          | Description                  |
| ----------------- | ------------- | ---------------------------- |
| `id`              | `uuid`        | Asteroid id.                 |
| `template_id`     | `text`        | Template key from config.    |
| `x`               | `integer`     | World X coordinate.          |
| `y`               | `integer`     | World Y coordinate.          |
| `remaining_units` | `integer`     | Remaining extractable units. |
| `seed`            | `text`        | Generation seed.             |
| `spawned_at`      | `timestamptz` | Spawn timestamp.             |
| `is_depleted`     | `boolean`     | Depletion flag.              |
| `created_at`      | `timestamptz` | Creation timestamp.          |
| `updated_at`      | `timestamptz` | Last update timestamp.       |

### `scanned_asteroids`

Purpose: per-player asteroid scan snapshot.

Key constraints:

- Primary key: `id`
- Foreign keys: `player_id -> players.id`, `asteroid_id -> asteroid.id`
- Unique latest snapshot key: `(player_id, asteroid_id)`
- Indexes: `player_id`, `asteroid_id`
- Non-negative units check: `remaining_units >= 0`

| Column            | Type          | Description                   |
| ----------------- | ------------- | ----------------------------- |
| `id`              | `uuid`        | Snapshot id.                  |
| `player_id`       | `uuid`        | Player id.                    |
| `asteroid_id`     | `uuid`        | Asteroid id.                  |
| `remaining_units` | `integer`     | Remaining units at scan time. |
| `scanned_at`      | `timestamptz` | Scan timestamp.               |
| `created_at`      | `timestamptz` | Creation timestamp.           |
| `updated_at`      | `timestamptz` | Last update timestamp.        |

### `mining_operations`

Purpose: mining operation lifecycle state.

Key constraints:

- Primary key: `id`
- Foreign keys: `station_id -> stations.id`, `asteroid_id -> asteroid.id`
- Indexes: `(station_id, completed_at)`, `(completed_at)`, `(due_at)`
- Unique open op per asteroid: unique `(asteroid_id)` where `completed_at IS NULL`
- Unique idempotency key when present

### `factory_jobs`

Purpose: factory production job state.

Key constraints:

- Primary key: `id`
- Foreign keys: `station_id -> stations.id`, `factory_building_id -> station_buildings.id`
- Indexes: `(station_id, completed_at)`, `(completed_at)`, `(due_at)`
- Unique idempotency key when present

### `domain_events`

Purpose: append-only due/processed domain events.

Key constraints:

- Primary key: `id`
- Foreign key: `station_id -> stations.id` (nullable)
- Index: `(due_at, processed_at)`
- Unique idempotency key

### `simulation_locks`

Purpose: optional station-level simulation locks.

Key constraints:

- Primary key and foreign key: `station_id -> stations.id`

### `sessions`

Purpose: server-side auth sessions.

Key constraints:

- Primary key: `id`
- Foreign key: `player_id -> players.id`
- Unique session token
- Indexes: `player_id`, `(expires_at, revoked_at)`
