CREATE TABLE "scanned_asteroids" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"player_id" uuid NOT NULL,
	"asteroid_id" uuid NOT NULL,
	"remaining_units" integer NOT NULL,
	"scanned_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "scanned_asteroids_remaining_units_non_negative_chk" CHECK ("scanned_asteroids"."remaining_units" >= 0)
);
--> statement-breakpoint
ALTER TABLE "scanned_asteroids" ADD CONSTRAINT "scanned_asteroids_player_id_players_id_fk" FOREIGN KEY ("player_id") REFERENCES "public"."players"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scanned_asteroids" ADD CONSTRAINT "scanned_asteroids_asteroid_id_asteroid_id_fk" FOREIGN KEY ("asteroid_id") REFERENCES "public"."asteroid"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "scanned_asteroids_player_asteroid_unique_idx" ON "scanned_asteroids" USING btree ("player_id","asteroid_id");--> statement-breakpoint
CREATE INDEX "scanned_asteroids_player_id_idx" ON "scanned_asteroids" USING btree ("player_id");--> statement-breakpoint
CREATE INDEX "scanned_asteroids_asteroid_id_idx" ON "scanned_asteroids" USING btree ("asteroid_id");
