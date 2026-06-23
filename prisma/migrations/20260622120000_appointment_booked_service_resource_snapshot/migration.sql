ALTER TABLE "appointment_booked_services"
  ADD COLUMN "service_price_default_in_cents" INTEGER,
  ADD COLUMN "service_price_specification_type" "ServicePriceType" NOT NULL DEFAULT 'FIXED',
  ADD COLUMN "service_price_range_max_in_cents" INTEGER,
  ADD COLUMN "service_is_active" BOOLEAN NOT NULL DEFAULT TRUE;

UPDATE "appointment_booked_services"
SET "service_price_default_in_cents" = "service_price_in_cents";

ALTER TABLE "appointment_booked_services"
  ALTER COLUMN "service_price_default_in_cents" SET NOT NULL;

ALTER TABLE "appointment_booked_services"
  ADD CONSTRAINT "appointment_booked_services_service_price_range_max_non_negative"
  CHECK ("service_price_range_max_in_cents" IS NULL OR "service_price_range_max_in_cents" >= 0);

ALTER TABLE "appointment_booked_services"
  ADD CONSTRAINT "appointment_booked_services_service_price_default_non_negative"
  CHECK ("service_price_default_in_cents" >= 0);

ALTER TABLE "appointment_booked_services"
  ADD CONSTRAINT "appointment_booked_services_service_price_range_max_requires_range"
  CHECK (
    ("service_price_specification_type" = 'RANGE' AND "service_price_range_max_in_cents" IS NOT NULL AND "service_price_range_max_in_cents" >= "service_price_default_in_cents")
    OR ("service_price_specification_type" <> 'RANGE' AND "service_price_range_max_in_cents" IS NULL)
  );
