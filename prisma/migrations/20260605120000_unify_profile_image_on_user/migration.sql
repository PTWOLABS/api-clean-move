-- Backfill employee profile images into linked users when missing
UPDATE "users" u
SET "profile_image_url" = e."profile_image_url"
FROM "employees" e
WHERE e."user_id" = u."id"
  AND e."profile_image_url" IS NOT NULL
  AND u."profile_image_url" IS NULL;

ALTER TABLE "employees" DROP COLUMN "profile_image_url";

ALTER TABLE "customers" DROP COLUMN "profile_image_url";
