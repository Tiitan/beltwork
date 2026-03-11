# Beltwork Architecture (Current Implementation)

This document reflects the currently implemented web + API behavior in this repository.

## 1. Goals and Constraints

### Goals

- Playable station and map loop with authentication and persistent state.
- Server-authoritative snapshots for station and map.
- Simple, testable architecture for iterative feature delivery.

### Current Constraints

- No websocket/push updates.
- API is authoritative; frontend refreshes by query/mutation responses.
- Build and upgrade flows for station buildings are temporary and free/instant.
- Some domain systems remain scaffolded for future iterations (persistent factory simulation).

## 2. Runtime Components

- `apps/web`: React + TypeScript SPA.
- `apps/api`: Fastify + TypeScript API.
- `postgres`: persistent storage for game/auth state.

Current API process also hosts in-memory factory job scaffolding used by factory routes.

## 3. Frontend Architecture

### 3.1 Authenticated Shell and Routes

Authenticated routes are mounted under one shell (`StationLayout` + `StationProvider`):

- `/station`: station canvas home
- `/map`: map canvas
- `/account`: account settings

Unauthenticated route:

- `/login`

Additional behavior:

- `/` redirects to `/station` when authenticated, else `/login`.
- `/station/*` unknown subpaths render a station-area not-found view.
- Legacy prefixed/nested route variants are removed from the canonical route set.

### 3.2 Station Page

The station home is a full-screen canvas scene:

- Background image: `public/assets/page/station_map.png`
- Fixed slot layout: 10 slots
- Camera interactions: pan/zoom with clamped boundaries to image extents
- Slot interactions:
  - hover/select by slot hit detection
  - selected slot opens right-side panel
- Rendering model:
  - occupied slots render building sprite
  - empty slots render `empty_platform.png`
  - hover highlights the sprite/platform, not borders

Panel system is generic:

- Core canvas logic is building-type agnostic.
- Panel registry maps building type -> panel component.
- Empty slot panel renders backend `buildable_buildings` and triggers build.

Implemented building panel coverage:

- `fusion_reactor`
- `life_support`
- `radiators`
- `mining_docks`
- `scanner_survey`
- `refinery`
- `assembler`
- `storage`
- unknown fallback panel

Panel actions:

- `Upgrade` on building panels (temporary free/instant).
- `Go to Map` on scanner/mining docks panels.
- Storage panel shows station inventory.

### 3.3 Map Page

Map is a full-screen canvas with entity renderers and right-side panel:

- Camera pan/zoom is clamped to API world bounds.
- Background draws world border rectangle (no origin cross lines).
- Entities: stations and asteroids.
- Asteroids support scan action via API (`POST /v1/asteroids/:id/scan`).

### 3.4 Frontend State Model

State is managed through `StationProvider` / `useStationState`:

- Station snapshot (`/v1/station`) drives station inventory/buildings/buildables.
- Map snapshot (`/v1/map`) drives map entities and bounds.
- Mutations (`build`, `upgrade`, `scan`) refresh local state from API responses.

No `react-query` usage in the current implementation.

## 4. Backend Architecture

### 4.1 API Surface (Implemented)

Session/Auth:

- `GET /v1/session/bootstrap`
- `POST /v1/session/start-now`
- `POST /v1/auth/login`
- `POST /auth/login` (alias)
- `POST /v1/auth/google`
- `POST /v1/settings/account`
- `POST /v1/settings/account/google-link`
- `POST /v1/session/logout`

Station:

- `GET /v1/station`
- `POST /v1/station/buildings`
- `PATCH /v1/station/buildings/:buildingId`

Map:

- `GET /v1/map`
- `POST /v1/asteroids/:id/scan`

Factory scaffolding:

- `POST /v1/factories/:id/select-blueprint`
- `POST /v1/factories/:id/catch-up`
- `POST /v1/factories/:id/clear-blueprint`
- `GET /v1/factories/:id`

Health:

- `GET /live`
- `GET /ready`

### 4.2 Station Snapshot Contract

`GET /v1/station` (and station build/upgrade responses) returns:

- root `id`, `x`, `y`
- `inventory[]`
- `buildings[]` with `slot_index`
- `buildable_buildings[]`

Placement is read from `station_buildings.slot_index`; there is no `stations.building_layout` in current contract.

### 4.3 Station Build/Upgrade Rules (Current Temporary Rules)

Build (`POST /v1/station/buildings`):

- input: `{ building_type, slot_index }`
- slot must be `1..10`
- slot must be empty
- only one building per type per station
- buildable types currently restricted to 8 station building ids
- created instantly at level 1 (free)

Upgrade (`PATCH /v1/station/buildings/:buildingId` with `{ action: 'upgrade' }`):

- building must belong to current player station
- increments level by 1 instantly (free)

Concurrency safety:

- build flow executes in transaction and locks station row (`FOR UPDATE`).

### 4.4 Map Contract

`GET /v1/map` returns:

- `world_bounds { min_x, max_x, min_y, max_y }`
- `stations[]`
- `asteroids[]`

Asteroids can be scanned per player; scanned rows include additional details such as
`name`, `yield_multiplier`, `composition`, and scanned snapshot metadata.

## 5. Persistence and Data Ownership

Current ownership summary:

- Station coordinates: `stations` (`x`, `y`)
- Building placement: `station_buildings.slot_index`
- Building identity/state: `station_buildings`
- Inventory: `station_inventory`
- Map asteroids: `asteroid`
- Per-player scanned asteroid snapshots: `scanned_asteroids`

Migration path used in this branch:

- `0004`: added temporary `stations.building_layout`
- `0005`: backfilled `station_buildings.slot_index`, enforced constraints, dropped `building_layout`

## 6. Future Work (Not Implemented Yet)

- Persistent factory job orchestration replacing in-memory scaffolding.
- Full event-driven worker loop with durable processing of due domain events.
- Cost/time-based building upgrade economy replacing temporary instant/free behavior.
