ALTER TYPE "public"."auth_type" ADD VALUE 'google';--> statement-breakpoint
CREATE TABLE "player_identities" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "player_id" uuid NOT NULL,
  "provider" text NOT NULL,
  "provider_user_id" text NOT NULL,
  "email" text,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);--> statement-breakpoint
ALTER TABLE "player_identities" ADD CONSTRAINT "player_identities_player_id_players_id_fk" FOREIGN KEY ("player_id") REFERENCES "public"."players"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "player_identities_provider_user_unique_idx" ON "player_identities" USING btree ("provider","provider_user_id");--> statement-breakpoint
CREATE INDEX "player_identities_player_id_idx" ON "player_identities" USING btree ("player_id");
