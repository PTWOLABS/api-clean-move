-- Existing codes cannot be confirmed without a pending password hash.
DELETE FROM "password_change_confirmation_codes";

-- AlterTable
ALTER TABLE "password_change_confirmation_codes" ADD COLUMN "pending_password_hash" TEXT NOT NULL,
ADD COLUMN "failed_attempts" INTEGER NOT NULL DEFAULT 0;
