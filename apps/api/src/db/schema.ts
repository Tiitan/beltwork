import { sql } from 'drizzle-orm'
import {
  boolean,
  check,
  index,
  integer,
  jsonb,
  numeric,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core'

/**
 * Authentication mode enum used by player records.
 */
export const authTypeEnum = pgEnum('auth_type', ['guest', 'local'])

/**
 * Player accounts and profile credentials.
 */
export const players = pgTable(
  'players',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    displayName: text('display_name').notNull(),
    email: text('email'),
    passwordHash: text('password_hash'),
    authType: authTypeEnum('auth_type').default('guest').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex('players_email_unique_idx')
      .on(table.email)
      .where(sql`${table.email} is not null`),
  ],
)

/**
 * Player-owned station root entity and coordinates.
 */
export const stations = pgTable(
  'stations',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    playerId: uuid('player_id')
      .references(() => players.id, { onDelete: 'cascade' })
      .notNull(),
    x: integer('x').notNull(),
    y: integer('y').notNull(),
    spawnedAt: timestamp('spawned_at', { withTimezone: true }).defaultNow().notNull(),
    lastSimulatedAt: timestamp('last_simulated_at', { withTimezone: true }).defaultNow().notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex('stations_player_id_unique_idx').on(table.playerId),
    index('stations_x_y_idx').on(table.x, table.y),
  ],
)

/**
 * Constructed buildings attached to a station.
 */
export const stationBuildings = pgTable(
  'station_buildings',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    stationId: uuid('station_id')
      .references(() => stations.id, { onDelete: 'cascade' })
      .notNull(),
    buildingType: text('building_type').notNull(),
    level: integer('level').default(1).notNull(),
    upgradeStartedAt: timestamp('upgrade_started_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex('station_buildings_station_type_unique_idx').on(
      table.stationId,
      table.buildingType,
    ),
  ],
)

/**
 * Material inventory balances stored per station.
 */
export const stationInventory = pgTable(
  'station_inventory',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    stationId: uuid('station_id')
      .references(() => stations.id, { onDelete: 'cascade' })
      .notNull(),
    resourceKey: text('resource_key').notNull(),
    amount: numeric('amount', { precision: 20, scale: 4 }).default('0').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex('station_inventory_station_resource_unique_idx').on(
      table.stationId,
      table.resourceKey,
    ),
    check('station_inventory_amount_non_negative_chk', sql`${table.amount} >= 0`),
  ],
)

/**
 * Persistent asteroid entities available for mining.
 */
export const asteroid = pgTable(
  'asteroid',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    templateId: text('template_id').notNull(),
    x: integer('x').notNull(),
    y: integer('y').notNull(),
    remainingUnits: integer('remaining_units').notNull(),
    seed: text('seed').notNull(),
    spawnedAt: timestamp('spawned_at', { withTimezone: true }).defaultNow().notNull(),
    isDepleted: boolean('is_depleted').default(false).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index('asteroid_depleted_template_idx').on(table.isDepleted, table.templateId),
    index('asteroid_x_y_idx').on(table.x, table.y),
    check('asteroid_remaining_units_non_negative_chk', sql`${table.remainingUnits} >= 0`),
  ],
)

/**
 * Active or completed mining operations from stations to asteroids.
 */
export const miningOperations = pgTable(
  'mining_operations',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    stationId: uuid('station_id')
      .references(() => stations.id, { onDelete: 'cascade' })
      .notNull(),
    asteroidId: uuid('asteroid_id')
      .references(() => asteroid.id)
      .notNull(),
    startedAt: timestamp('started_at', { withTimezone: true }).defaultNow().notNull(),
    completedAt: timestamp('completed_at', { withTimezone: true }),
    dueAt: timestamp('due_at', { withTimezone: true }),
    rigPower: integer('rig_power').default(1).notNull(),
    distanceMultiplier: numeric('distance_multiplier', { precision: 12, scale: 6 })
      .default('1')
      .notNull(),
    idempotencyKey: text('idempotency_key'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index('mining_operations_station_completed_idx').on(table.stationId, table.completedAt),
    index('mining_operations_completed_at_idx').on(table.completedAt),
    index('mining_operations_due_at_idx').on(table.dueAt),
    uniqueIndex('mining_operations_open_asteroid_unique_idx')
      .on(table.asteroidId)
      .where(sql`${table.completedAt} is null`),
    uniqueIndex('mining_operations_idempotency_key_unique_idx')
      .on(table.idempotencyKey)
      .where(sql`${table.idempotencyKey} is not null`),
  ],
)

/**
 * Factory production jobs for station factory buildings.
 */
export const factoryJobs = pgTable(
  'factory_jobs',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    stationId: uuid('station_id')
      .references(() => stations.id, { onDelete: 'cascade' })
      .notNull(),
    factoryBuildingId: uuid('factory_building_id').references(() => stationBuildings.id, {
      onDelete: 'cascade',
    }),
    recipeKey: text('recipe_key'),
    selectedAt: timestamp('selected_at', { withTimezone: true }).defaultNow().notNull(),
    dueAt: timestamp('due_at', { withTimezone: true }),
    cyclesCompleted: integer('cycles_completed').default(0).notNull(),
    targetCycles: integer('target_cycles'),
    completedAt: timestamp('completed_at', { withTimezone: true }),
    idempotencyKey: text('idempotency_key'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index('factory_jobs_station_completed_idx').on(table.stationId, table.completedAt),
    index('factory_jobs_completed_at_idx').on(table.completedAt),
    index('factory_jobs_due_at_idx').on(table.dueAt),
    uniqueIndex('factory_jobs_idempotency_key_unique_idx')
      .on(table.idempotencyKey)
      .where(sql`${table.idempotencyKey} is not null`),
    check('factory_jobs_cycles_completed_non_negative_chk', sql`${table.cyclesCompleted} >= 0`),
    check(
      'factory_jobs_target_cycles_valid_chk',
      sql`${table.targetCycles} is null or ${table.targetCycles} > 0`,
    ),
  ],
)

/**
 * Outbox-style domain events for deferred processing.
 */
export const domainEvents = pgTable(
  'domain_events',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    stationId: uuid('station_id').references(() => stations.id, { onDelete: 'cascade' }),
    eventType: text('event_type').notNull(),
    payloadJson: jsonb('payload_json').default({}).notNull(),
    idempotencyKey: text('idempotency_key').notNull(),
    dueAt: timestamp('due_at', { withTimezone: true }).defaultNow().notNull(),
    processedAt: timestamp('processed_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index('domain_events_due_processed_idx').on(table.dueAt, table.processedAt),
    index('domain_events_station_id_idx').on(table.stationId),
    uniqueIndex('domain_events_idempotency_key_unique_idx').on(table.idempotencyKey),
  ],
)

/**
 * Per-station locks used for simulation coordination.
 */
export const simulationLocks = pgTable('simulation_locks', {
  stationId: uuid('station_id')
    .primaryKey()
    .references(() => stations.id, { onDelete: 'cascade' }),
  lockedBy: text('locked_by').notNull(),
  lockedAt: timestamp('locked_at', { withTimezone: true }).defaultNow().notNull(),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
})

/**
 * Login sessions and lifecycle metadata for authenticated players.
 */
export const sessions = pgTable(
  'sessions',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    playerId: uuid('player_id')
      .references(() => players.id, { onDelete: 'cascade' })
      .notNull(),
    sessionToken: text('session_token').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    revokedAt: timestamp('revoked_at', { withTimezone: true }),
    lastSeenAt: timestamp('last_seen_at', { withTimezone: true }),
  },
  (table) => [
    uniqueIndex('sessions_session_token_unique_idx').on(table.sessionToken),
    index('sessions_player_id_idx').on(table.playerId),
    index('sessions_expires_revoked_idx').on(table.expiresAt, table.revokedAt),
  ],
)
