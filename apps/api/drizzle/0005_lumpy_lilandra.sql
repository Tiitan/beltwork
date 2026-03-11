ALTER TABLE "station_buildings" ADD COLUMN "slot_index" integer;--> statement-breakpoint

-- Backfill from legacy stations.building_layout where entries are valid 1..10 slot keys.
UPDATE "station_buildings" AS sb
SET "slot_index" = mapped."slot_index"
FROM (
  SELECT
    s."id" AS "station_id",
    (e."key")::integer AS "slot_index",
    e."value" AS "building_id"
  FROM "stations" AS s
  CROSS JOIN LATERAL jsonb_each_text(s."building_layout") AS e("key", "value")
  WHERE e."key" ~ '^[0-9]+$'
    AND (e."key")::integer BETWEEN 1 AND 10
) AS mapped
WHERE sb."station_id" = mapped."station_id"
  AND sb."id"::text = mapped."building_id"
  AND sb."slot_index" IS NULL;--> statement-breakpoint

-- Fail if any station has more buildings than available slots after initial mapping.
DO $$
BEGIN
  IF EXISTS (
    WITH unassigned AS (
      SELECT sb."station_id", count(*)::integer AS "unassigned_count"
      FROM "station_buildings" AS sb
      WHERE sb."slot_index" IS NULL
      GROUP BY sb."station_id"
    ),
    free_slots AS (
      SELECT s."id" AS "station_id", count(*)::integer AS "free_count"
      FROM "stations" AS s
      CROSS JOIN generate_series(1, 10) AS gs("slot_index")
      LEFT JOIN "station_buildings" AS sb
        ON sb."station_id" = s."id"
       AND sb."slot_index" = gs."slot_index"
      WHERE sb."id" IS NULL
      GROUP BY s."id"
    )
    SELECT 1
    FROM unassigned AS u
    LEFT JOIN free_slots AS f ON f."station_id" = u."station_id"
    WHERE u."unassigned_count" > COALESCE(f."free_count", 0)
  ) THEN
    RAISE EXCEPTION 'station_buildings slot backfill failed: station exceeds 10 slots';
  END IF;
END $$;--> statement-breakpoint

-- Deterministic auto-heal: assign remaining buildings to first free slots by created_at/id.
WITH unassigned_ranked AS (
  SELECT
    sb."id" AS "building_id",
    sb."station_id",
    row_number() OVER (
      PARTITION BY sb."station_id"
      ORDER BY sb."created_at", sb."id"
    ) AS "rank"
  FROM "station_buildings" AS sb
  WHERE sb."slot_index" IS NULL
),
free_slots_ranked AS (
  SELECT
    x."station_id",
    x."slot_index",
    row_number() OVER (
      PARTITION BY x."station_id"
      ORDER BY x."slot_index"
    ) AS "rank"
  FROM (
    SELECT
      s."id" AS "station_id",
      gs."slot_index"
    FROM "stations" AS s
    CROSS JOIN generate_series(1, 10) AS gs("slot_index")
    LEFT JOIN "station_buildings" AS sb
      ON sb."station_id" = s."id"
     AND sb."slot_index" = gs."slot_index"
    WHERE sb."id" IS NULL
  ) AS x
),
assignments AS (
  SELECT
    u."building_id",
    f."slot_index"
  FROM unassigned_ranked AS u
  JOIN free_slots_ranked AS f
    ON f."station_id" = u."station_id"
   AND f."rank" = u."rank"
)
UPDATE "station_buildings" AS sb
SET "slot_index" = a."slot_index"
FROM assignments AS a
WHERE sb."id" = a."building_id";--> statement-breakpoint

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM "station_buildings" AS sb
    WHERE sb."slot_index" IS NULL
  ) THEN
    RAISE EXCEPTION 'station_buildings slot backfill failed: unresolved slot_index values';
  END IF;
END $$;--> statement-breakpoint

ALTER TABLE "station_buildings" ALTER COLUMN "slot_index" SET NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "station_buildings_station_slot_unique_idx" ON "station_buildings" USING btree ("station_id","slot_index");--> statement-breakpoint
ALTER TABLE "station_buildings" ADD CONSTRAINT "station_buildings_slot_index_range_chk" CHECK ("station_buildings"."slot_index" >= 1 and "station_buildings"."slot_index" <= 10);--> statement-breakpoint
ALTER TABLE "stations" DROP COLUMN "building_layout";
