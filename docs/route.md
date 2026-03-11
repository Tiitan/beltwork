# Route Reference

This document describes the current API and frontend route contracts in the repository.

## 1. API Routes (Implemented)

## 1.1 Health

| Method | Path     | Purpose               |
| ------ | -------- | --------------------- |
| `GET`  | `/live`  | Liveness probe.       |
| `GET`  | `/ready` | Readiness (DB) probe. |

## 1.2 Session and Account

| Method | Path                               | Purpose                                  |
| ------ | ---------------------------------- | ---------------------------------------- |
| `GET`  | `/v1/session/bootstrap`            | Resolve auth state from cookie session.  |
| `POST` | `/v1/session/start-now`            | Create guest player + station + session. |
| `POST` | `/v1/auth/login`                   | Email/password login.                    |
| `POST` | `/auth/login`                      | Alias for `/v1/auth/login`.              |
| `POST` | `/v1/auth/google`                  | Google sign-in.                          |
| `POST` | `/v1/settings/account`             | Save account settings / guest upgrade.   |
| `POST` | `/v1/settings/account/google-link` | Link Google identity to current account. |
| `POST` | `/v1/session/logout`               | Revoke session and clear cookie.         |

## 1.3 Station

| Method  | Path                                | Purpose                                                  |
| ------- | ----------------------------------- | -------------------------------------------------------- |
| `GET`   | `/v1/station`                       | Return station snapshot for current player.              |
| `POST`  | `/v1/station/buildings`             | Build building in station slot (temporary free/instant). |
| `PATCH` | `/v1/station/buildings/:buildingId` | Upgrade building level (temporary free/instant).         |

### Station Build Request

`POST /v1/station/buildings`

```json
{
  "building_type": "fusion_reactor",
  "slot_index": 1
}
```

### Station Upgrade Request

`PATCH /v1/station/buildings/:buildingId`

```json
{
  "action": "upgrade"
}
```

### Station Snapshot Response Shape

Used by:

- `GET /v1/station`
- `POST /v1/station/buildings`
- `PATCH /v1/station/buildings/:buildingId`

```json
{
  "id": "station-uuid",
  "x": 1234,
  "y": 5678,
  "inventory": [{ "resource_key": "metals", "amount": 100 }],
  "buildings": [
    {
      "id": "building-uuid",
      "building_type": "fusion_reactor",
      "level": 2,
      "status": "idle",
      "slot_index": 1
    }
  ],
  "buildable_buildings": [{ "id": "life_support", "name": "Life Support" }]
}
```

Notes:

- `id`, `x`, `y` are root fields.
- `building_layout` is removed.
- Slot ownership is represented in `buildings[].slot_index`.

## 1.4 Map and Asteroids

| Method | Path                     | Purpose                                                         |
| ------ | ------------------------ | --------------------------------------------------------------- |
| `GET`  | `/v1/map`                | Return world bounds + stations + asteroids for player map view. |
| `POST` | `/v1/asteroids/:id/scan` | Persist/update player scan snapshot for asteroid.               |

### Map Snapshot Response Shape

```json
{
  "world_bounds": {
    "min_x": 0,
    "max_x": 10000,
    "min_y": 0,
    "max_y": 10000
  },
  "stations": [{ "id": "station-uuid", "name": "Commander", "x": 1234, "y": 5678 }],
  "asteroids": [{ "id": "ast-uuid", "x": 2222, "y": 3333, "is_scanned": false }]
}
```

## 1.5 Factory (Current Scaffolding)

| Method | Path                                 | Purpose                                |
| ------ | ------------------------------------ | -------------------------------------- |
| `POST` | `/v1/factories/:id/select-blueprint` | Select factory blueprint.              |
| `POST` | `/v1/factories/:id/catch-up`         | Run factory catch-up for elapsed time. |
| `POST` | `/v1/factories/:id/clear-blueprint`  | Clear current blueprint.               |
| `GET`  | `/v1/factories/:id`                  | Read factory job state.                |

These endpoints are currently backed by in-memory job scaffolding.

## 2. Frontend Route Contract (Implemented)

| Path         | Auth Required | Purpose                                               |
| ------------ | ------------- | ----------------------------------------------------- |
| `/`          | Conditional   | Redirects to `/station` (auth) or `/login` (no auth). |
| `/login`     | No            | Sign in / Start now entry page.                       |
| `/station`   | Yes           | Station canvas home page.                             |
| `/station/*` | Yes           | Station-area not-found for unknown station subpaths.  |
| `/map`       | Yes           | World map canvas page.                                |
| `/account`   | Yes           | Account settings page.                                |

Canonical authenticated routes are `/station`, `/map`, `/account`.

Legacy path notes:

- Legacy prefixed and nested route variants are removed from the canonical route set.

## 3. Error Shape Notes (Selected)

Common route errors include:

- `401 unauthorized`
- `400 invalid_payload`
- `404 station_not_found` / `building_not_found` / `asteroid_not_found`
- `409 slot_occupied` / `building_type_already_exists`

Exact error mapping is implemented in route handlers under `apps/api/src/routes`.
