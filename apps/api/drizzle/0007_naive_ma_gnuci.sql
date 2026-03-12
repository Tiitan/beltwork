CREATE TYPE "public"."journal_importance" AS ENUM('info', 'important', 'warning');--> statement-breakpoint
CREATE TABLE "player_journal_entries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"player_id" uuid NOT NULL,
	"station_id" uuid,
	"event_type" text NOT NULL,
	"importance" "journal_importance" NOT NULL,
	"description" text NOT NULL,
	"occurred_at" timestamp with time zone NOT NULL,
	"metadata_json" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "player_journal_entries" ADD CONSTRAINT "player_journal_entries_player_id_players_id_fk" FOREIGN KEY ("player_id") REFERENCES "public"."players"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "player_journal_entries" ADD CONSTRAINT "player_journal_entries_station_id_stations_id_fk" FOREIGN KEY ("station_id") REFERENCES "public"."stations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "player_journal_entries_player_occurred_idx" ON "player_journal_entries" USING btree ("player_id","occurred_at");--> statement-breakpoint
CREATE INDEX "player_journal_entries_station_occurred_idx" ON "player_journal_entries" USING btree ("station_id","occurred_at");--> statement-breakpoint
CREATE INDEX "player_journal_entries_event_type_idx" ON "player_journal_entries" USING btree ("event_type");
