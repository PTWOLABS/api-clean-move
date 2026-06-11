-- CreateTable
CREATE TABLE "service_categories" (
    "id" UUID NOT NULL,
    "establishment_id" UUID NOT NULL,
    "name" VARCHAR(48) NOT NULL,
    "deleted_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "service_categories_pkey" PRIMARY KEY ("id")
);

-- Seed default categories for each existing establishment
INSERT INTO "service_categories" ("id", "establishment_id", "name", "created_at", "updated_at")
SELECT gen_random_uuid(), e."id", cat."name", CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM "establishments" e
CROSS JOIN (
    VALUES
        ('WASH', 'Lavagem'),
        ('SANITIZATION', 'Higienização'),
        ('AUTOMATIVE_DETAILING', 'Detailing Automotivo'),
        ('PROTECTION', 'Proteção'),
        ('UPHOLSTERY', 'Estofamento')
) AS cat("enum_value", "name");

-- Add category_id to services
ALTER TABLE "services" ADD COLUMN "category_id" UUID;

-- Backfill services.category_id from enum
UPDATE "services" s
SET "category_id" = sc."id"
FROM "service_categories" sc
WHERE sc."establishment_id" = s."establishment_id"
  AND s."category" IS NOT NULL
  AND sc."name" = CASE s."category"
    WHEN 'WASH' THEN 'Lavagem'
    WHEN 'SANITIZATION' THEN 'Higienização'
    WHEN 'AUTOMATIVE_DETAILING' THEN 'Detailing Automotivo'
    WHEN 'PROTECTION' THEN 'Proteção'
    WHEN 'UPHOLSTERY' THEN 'Estofamento'
  END;

-- Drop old category column and index on services
DROP INDEX IF EXISTS "services_establishment_id_category_idx";
ALTER TABLE "services" DROP COLUMN "category";

-- Add snapshot columns to appointment_booked_services
ALTER TABLE "appointment_booked_services"
    ADD COLUMN "service_category_id" UUID,
    ADD COLUMN "service_category_name" VARCHAR(48);

UPDATE "appointment_booked_services" abs
SET
    "service_category_id" = sc."id",
    "service_category_name" = sc."name"
FROM "appointments" a
JOIN "service_categories" sc ON sc."establishment_id" = a."establishment_id"
WHERE abs."appointment_id" = a."id"
  AND abs."service_category" IS NOT NULL
  AND sc."name" = CASE abs."service_category"
    WHEN 'WASH' THEN 'Lavagem'
    WHEN 'SANITIZATION' THEN 'Higienização'
    WHEN 'AUTOMATIVE_DETAILING' THEN 'Detailing Automotivo'
    WHEN 'PROTECTION' THEN 'Proteção'
    WHEN 'UPHOLSTERY' THEN 'Estofamento'
  END;

ALTER TABLE "appointment_booked_services" DROP COLUMN "service_category";

-- Add snapshot columns to quote_services
ALTER TABLE "quote_services"
    ADD COLUMN "service_category_id" UUID,
    ADD COLUMN "service_category_name" VARCHAR(48);

UPDATE "quote_services" qs
SET
    "service_category_id" = sc."id",
    "service_category_name" = sc."name"
FROM "quotes" q
JOIN "service_categories" sc ON sc."establishment_id" = q."establishment_id"
WHERE qs."quote_id" = q."id"
  AND qs."service_category" IS NOT NULL
  AND sc."name" = CASE qs."service_category"
    WHEN 'WASH' THEN 'Lavagem'
    WHEN 'SANITIZATION' THEN 'Higienização'
    WHEN 'AUTOMATIVE_DETAILING' THEN 'Detailing Automotivo'
    WHEN 'PROTECTION' THEN 'Proteção'
    WHEN 'UPHOLSTERY' THEN 'Estofamento'
  END;

ALTER TABLE "quote_services" DROP COLUMN "service_category";

-- Drop enum type
DROP TYPE "ServiceCategory";

-- CreateIndex
CREATE INDEX "service_categories_establishment_id_deleted_at_idx" ON "service_categories"("establishment_id", "deleted_at");

-- CreateIndex
CREATE UNIQUE INDEX "service_categories_establishment_id_name_key" ON "service_categories"("establishment_id", "name");

-- CreateIndex
CREATE INDEX "services_establishment_id_category_id_idx" ON "services"("establishment_id", "category_id");

-- AddForeignKey
ALTER TABLE "service_categories" ADD CONSTRAINT "service_categories_establishment_id_fkey" FOREIGN KEY ("establishment_id") REFERENCES "establishments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "services" ADD CONSTRAINT "services_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "service_categories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
