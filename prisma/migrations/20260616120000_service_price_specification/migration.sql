CREATE TYPE "ServicePriceType" AS ENUM ('FIXED', 'STARTING_AT', 'RANGE');

ALTER TABLE "services"
  ADD COLUMN "price_specification_type" "ServicePriceType" NOT NULL DEFAULT 'FIXED',
  ADD COLUMN "price_range_max_in_cents" INTEGER;

ALTER TABLE "services"
  ADD CONSTRAINT "services_price_range_max_in_cents_non_negative"
  CHECK ("price_range_max_in_cents" IS NULL OR "price_range_max_in_cents" >= 0);

ALTER TABLE "services"
  ADD CONSTRAINT "services_price_range_max_requires_range"
  CHECK (
    ("price_specification_type" = 'RANGE' AND "price_range_max_in_cents" IS NOT NULL AND "price_range_max_in_cents" >= "price_in_cents")
    OR ("price_specification_type" <> 'RANGE' AND "price_range_max_in_cents" IS NULL)
  );
