CREATE TYPE "public"."auth_type" AS ENUM('guest', 'local');--> statement-breakpoint
CREATE TABLE "asteroid" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"template_id" text NOT NULL,
	"x" integer NOT NULL,
	"y" integer NOT NULL,
	"remaining_units" integer NOT NULL,
	"seed" text NOT NULL,
	"spawned_at" timestamp with time zone DEFAULT now() NOT NULL,
	"is_depleted" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "asteroid_remaining_units_non_negative_chk" CHECK ("asteroid"."remaining_units" >= 0)
);
--> statement-breakpoint
CREATE TABLE "domain_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"station_id" uuid,
	"event_type" text NOT NULL,
	"payload_json" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"idempotency_key" text NOT NULL,
	"due_at" timestamp with time zone DEFAULT now() NOT NULL,
	"processed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "factory_jobs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"station_id" uuid NOT NULL,
	"factory_building_id" uuid,
	"recipe_key" text,
	"selected_at" timestamp with time zone DEFAULT now() NOT NULL,
	"due_at" timestamp with time zone,
	"cycles_completed" integer DEFAULT 0 NOT NULL,
	"target_cycles" integer,
	"completed_at" timestamp with time zone,
	"idempotency_key" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "factory_jobs_cycles_completed_non_negative_chk" CHECK ("factory_jobs"."cycles_completed" >= 0),
	CONSTRAINT "factory_jobs_target_cycles_valid_chk" CHECK ("factory_jobs"."target_cycles" is null or "factory_jobs"."target_cycles" > 0)
);
--> statement-breakpoint
CREATE TABLE "mining_operations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"station_id" uuid NOT NULL,
	"asteroid_id" uuid NOT NULL,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"completed_at" timestamp with time zone,
	"due_at" timestamp with time zone,
	"rig_power" integer DEFAULT 1 NOT NULL,
	"distance_multiplier" numeric(12, 6) DEFAULT '1' NOT NULL,
	"idempotency_key" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "players" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"display_name" text NOT NULL,
	"email" text,
	"password_hash" text,
	"auth_type" "auth_type" DEFAULT 'guest' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"player_id" uuid NOT NULL,
	"session_token" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"revoked_at" timestamp with time zone,
	"last_seen_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "simulation_locks" (
	"station_id" uuid PRIMARY KEY NOT NULL,
	"locked_by" text NOT NULL,
	"locked_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "station_buildings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"station_id" uuid NOT NULL,
	"building_type" text NOT NULL,
	"level" integer DEFAULT 1 NOT NULL,
	"upgrade_started_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "station_inventory" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"station_id" uuid NOT NULL,
	"resource_key" text NOT NULL,
	"amount" numeric(20, 4) DEFAULT '0' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "station_inventory_amount_non_negative_chk" CHECK ("station_inventory"."amount" >= 0)
);
--> statement-breakpoint
CREATE TABLE "stations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"player_id" uuid NOT NULL,
	"x" integer NOT NULL,
	"y" integer NOT NULL,
	"spawned_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_simulated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "domain_events" ADD CONSTRAINT "domain_events_station_id_stations_id_fk" FOREIGN KEY ("station_id") REFERENCES "public"."stations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "factory_jobs" ADD CONSTRAINT "factory_jobs_station_id_stations_id_fk" FOREIGN KEY ("station_id") REFERENCES "public"."stations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "factory_jobs" ADD CONSTRAINT "factory_jobs_factory_building_id_station_buildings_id_fk" FOREIGN KEY ("factory_building_id") REFERENCES "public"."station_buildings"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mining_operations" ADD CONSTRAINT "mining_operations_station_id_stations_id_fk" FOREIGN KEY ("station_id") REFERENCES "public"."stations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mining_operations" ADD CONSTRAINT "mining_operations_asteroid_id_asteroid_id_fk" FOREIGN KEY ("asteroid_id") REFERENCES "public"."asteroid"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_player_id_players_id_fk" FOREIGN KEY ("player_id") REFERENCES "public"."players"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "simulation_locks" ADD CONSTRAINT "simulation_locks_station_id_stations_id_fk" FOREIGN KEY ("station_id") REFERENCES "public"."stations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "station_buildings" ADD CONSTRAINT "station_buildings_station_id_stations_id_fk" FOREIGN KEY ("station_id") REFERENCES "public"."stations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "station_inventory" ADD CONSTRAINT "station_inventory_station_id_stations_id_fk" FOREIGN KEY ("station_id") REFERENCES "public"."stations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stations" ADD CONSTRAINT "stations_player_id_players_id_fk" FOREIGN KEY ("player_id") REFERENCES "public"."players"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "asteroid_depleted_template_idx" ON "asteroid" USING btree ("is_depleted","template_id");--> statement-breakpoint
CREATE INDEX "asteroid_x_y_idx" ON "asteroid" USING btree ("x","y");--> statement-breakpoint
CREATE INDEX "domain_events_due_processed_idx" ON "domain_events" USING btree ("due_at","processed_at");--> statement-breakpoint
CREATE INDEX "domain_events_station_id_idx" ON "domain_events" USING btree ("station_id");--> statement-breakpoint
CREATE UNIQUE INDEX "domain_events_idempotency_key_unique_idx" ON "domain_events" USING btree ("idempotency_key");--> statement-breakpoint
CREATE INDEX "factory_jobs_station_completed_idx" ON "factory_jobs" USING btree ("station_id","completed_at");--> statement-breakpoint
CREATE INDEX "factory_jobs_completed_at_idx" ON "factory_jobs" USING btree ("completed_at");--> statement-breakpoint
CREATE INDEX "factory_jobs_due_at_idx" ON "factory_jobs" USING btree ("due_at");--> statement-breakpoint
CREATE UNIQUE INDEX "factory_jobs_idempotency_key_unique_idx" ON "factory_jobs" USING btree ("idempotency_key") WHERE "factory_jobs"."idempotency_key" is not null;--> statement-breakpoint
CREATE INDEX "mining_operations_station_completed_idx" ON "mining_operations" USING btree ("station_id","completed_at");--> statement-breakpoint
CREATE INDEX "mining_operations_completed_at_idx" ON "mining_operations" USING btree ("completed_at");--> statement-breakpoint
CREATE INDEX "mining_operations_due_at_idx" ON "mining_operations" USING btree ("due_at");--> statement-breakpoint
CREATE UNIQUE INDEX "mining_operations_open_asteroid_unique_idx" ON "mining_operations" USING btree ("asteroid_id") WHERE "mining_operations"."completed_at" is null;--> statement-breakpoint
CREATE UNIQUE INDEX "mining_operations_idempotency_key_unique_idx" ON "mining_operations" USING btree ("idempotency_key") WHERE "mining_operations"."idempotency_key" is not null;--> statement-breakpoint
CREATE UNIQUE INDEX "players_email_unique_idx" ON "players" USING btree ("email") WHERE "players"."email" is not null;--> statement-breakpoint
CREATE UNIQUE INDEX "sessions_session_token_unique_idx" ON "sessions" USING btree ("session_token");--> statement-breakpoint
CREATE INDEX "sessions_player_id_idx" ON "sessions" USING btree ("player_id");--> statement-breakpoint
CREATE INDEX "sessions_expires_revoked_idx" ON "sessions" USING btree ("expires_at","revoked_at");--> statement-breakpoint
CREATE UNIQUE INDEX "station_buildings_station_type_unique_idx" ON "station_buildings" USING btree ("station_id","building_type");--> statement-breakpoint
CREATE UNIQUE INDEX "station_inventory_station_resource_unique_idx" ON "station_inventory" USING btree ("station_id","resource_key");--> statement-breakpoint
CREATE UNIQUE INDEX "stations_player_id_unique_idx" ON "stations" USING btree ("player_id");--> statement-breakpoint
CREATE INDEX "stations_x_y_idx" ON "stations" USING btree ("x","y");