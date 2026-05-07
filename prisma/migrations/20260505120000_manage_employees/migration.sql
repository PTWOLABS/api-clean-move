ALTER TABLE "employees" ADD COLUMN "deleted_at" TIMESTAMP(3);

CREATE INDEX "employees_establishment_id_deleted_at_idx"
ON "employees"("establishment_id", "deleted_at");

UPDATE "employees"
SET "features" =
  "features"
  || CASE
    WHEN NOT ('read:employees:self' = ANY("features"))
    THEN ARRAY['read:employees:self']::text[]
    ELSE ARRAY[]::text[]
  END
  || CASE
    WHEN NOT ('create:sessions:self' = ANY("features"))
    THEN ARRAY['create:sessions:self']::text[]
    ELSE ARRAY[]::text[]
  END
  || CASE
    WHEN NOT ('read:sessions:self' = ANY("features"))
    THEN ARRAY['read:sessions:self']::text[]
    ELSE ARRAY[]::text[]
  END;
