ALTER TABLE "employees"
ALTER COLUMN "features" SET DEFAULT ARRAY[
  'read:appointments',
  'read:services',
  'read:customers',
  'read:employees:self',
  'create:sessions:self',
  'read:sessions:self'
]::TEXT[];

UPDATE "employees"
SET "features" =
  COALESCE("features", ARRAY[]::text[])
  || CASE
    WHEN NOT ('read:appointments' = ANY(COALESCE("features", ARRAY[]::text[])))
    THEN ARRAY['read:appointments']::text[]
    ELSE ARRAY[]::text[]
  END
  || CASE
    WHEN NOT ('read:services' = ANY(COALESCE("features", ARRAY[]::text[])))
    THEN ARRAY['read:services']::text[]
    ELSE ARRAY[]::text[]
  END
  || CASE
    WHEN NOT ('read:customers' = ANY(COALESCE("features", ARRAY[]::text[])))
    THEN ARRAY['read:customers']::text[]
    ELSE ARRAY[]::text[]
  END
  || CASE
    WHEN NOT ('read:employees:self' = ANY(COALESCE("features", ARRAY[]::text[])))
    THEN ARRAY['read:employees:self']::text[]
    ELSE ARRAY[]::text[]
  END;

UPDATE "employees"
SET "features" =
  "features"
  || CASE
    WHEN NOT ('create:sessions:self' = ANY("features"))
    THEN ARRAY['create:sessions:self']::text[]
    ELSE ARRAY[]::text[]
  END
  || CASE
    WHEN NOT ('read:sessions:self' = ANY("features"))
    THEN ARRAY['read:sessions:self']::text[]
    ELSE ARRAY[]::text[]
  END
WHERE "deleted_at" IS NULL;

UPDATE "employees"
SET "features" = ARRAY_REMOVE(
  ARRAY_REMOVE("features", 'create:sessions:self'),
  'read:sessions:self'
)
WHERE "deleted_at" IS NOT NULL;

ALTER TABLE "employees"
ALTER COLUMN "features" SET NOT NULL;
