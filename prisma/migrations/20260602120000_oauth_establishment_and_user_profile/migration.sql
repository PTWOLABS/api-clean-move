-- Add profile image to users
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "profile_image_url" TEXT;

-- Migrate establishment profile images to owner users (only if column still exists)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_name = 'establishments'
      AND column_name = 'profile_image_url'
  ) THEN
    UPDATE "users" u
    SET "profile_image_url" = e."profile_image_url"
    FROM "establishments" e
    WHERE e."owner_id" = u."id"
      AND e."profile_image_url" IS NOT NULL;
  END IF;
END $$;

-- Drop profile image from establishments
ALTER TABLE "establishments" DROP COLUMN IF EXISTS "profile_image_url";

-- Allow incomplete commercial profile on establishments
ALTER TABLE "establishments" ALTER COLUMN "tradeName" DROP NOT NULL;
ALTER TABLE "establishments" ALTER COLUMN "legalBusinessName" DROP NOT NULL;
ALTER TABLE "establishments" ALTER COLUMN "slug" DROP NOT NULL;
ALTER TABLE "establishments" ALTER COLUMN "cnpj" DROP NOT NULL;
