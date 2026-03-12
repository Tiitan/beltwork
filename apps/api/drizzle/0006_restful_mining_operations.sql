ALTER TABLE "mining_operations" ADD COLUMN "status" text DEFAULT 'flying_to_destination' NOT NULL;--> statement-breakpoint
ALTER TABLE "mining_operations" ADD COLUMN "phase_started_at" timestamp with time zone DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "mining_operations" ADD COLUMN "phase_finish_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "mining_operations" ADD COLUMN "cargo_capacity" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "mining_operations" ADD COLUMN "quantity" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "mining_operations" ADD COLUMN "quantity_target" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "mining_operations" ADD COLUMN "estimated_asteroid_remaining_units" integer;--> statement-breakpoint
ALTER TABLE "mining_operations" ADD COLUMN "asteroid_remaining_units_at_mining_start" integer;--> statement-breakpoint
ALTER TABLE "mining_operations" ADD CONSTRAINT "mining_operations_cargo_capacity_non_negative_chk" CHECK ("mining_operations"."cargo_capacity" >= 0);--> statement-breakpoint
ALTER TABLE "mining_operations" ADD CONSTRAINT "mining_operations_quantity_non_negative_chk" CHECK ("mining_operations"."quantity" >= 0);--> statement-breakpoint
ALTER TABLE "mining_operations" ADD CONSTRAINT "mining_operations_quantity_target_non_negative_chk" CHECK ("mining_operations"."quantity_target" >= 0);--> statement-breakpoint
ALTER TABLE "mining_operations" ADD CONSTRAINT "mining_operations_quantity_le_target_chk" CHECK ("mining_operations"."quantity" <= "mining_operations"."quantity_target");--> statement-breakpoint
DROP INDEX "mining_operations_open_asteroid_unique_idx";--> statement-breakpoint
CREATE INDEX "mining_operations_status_completed_idx" ON "mining_operations" USING btree ("status","completed_at");--> statement-breakpoint
CREATE UNIQUE INDEX "mining_operations_active_asteroid_mining_unique_idx" ON "mining_operations" USING btree ("asteroid_id") WHERE "mining_operations"."completed_at" is null and "mining_operations"."status" = 'mining';
