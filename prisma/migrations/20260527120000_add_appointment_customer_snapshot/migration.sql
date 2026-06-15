-- AlterTable
ALTER TABLE "appointments" ADD COLUMN "customer_full_name" TEXT;

-- Backfill existing appointments from their current customer record.
UPDATE "appointments" AS "appointment"
SET "customer_full_name" = "customer"."full_name"
FROM "customers" AS "customer"
WHERE "appointment"."customer_id" = "customer"."id";

ALTER TABLE "appointments" ALTER COLUMN "customer_full_name" SET NOT NULL;
