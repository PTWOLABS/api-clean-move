-- Backfill legacy vehicles before enforcing NOT NULL constraints.
UPDATE "customer_vehicles"
SET "brand" = 'Não informado'
WHERE "brand" IS NULL OR BTRIM("brand") = '';

UPDATE "customer_vehicles"
SET "model" = 'Não informado'
WHERE "model" IS NULL OR BTRIM("model") = '';

-- AlterTable
ALTER TABLE "customer_vehicles" ALTER COLUMN "brand" SET NOT NULL;
ALTER TABLE "customer_vehicles" ALTER COLUMN "model" SET NOT NULL;
