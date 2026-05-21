-- CreateTable
CREATE TABLE "appointment_booked_services" (
    "id" UUID NOT NULL,
    "appointment_id" UUID NOT NULL,
    "service_id" UUID NOT NULL,
    "service_name" VARCHAR(72) NOT NULL,
    "service_category" "ServiceCategory",
    "service_duration_in_minutes" INTEGER,
    "service_price_in_cents" INTEGER NOT NULL,
    "position" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "appointment_booked_services_pkey" PRIMARY KEY ("id")
);

-- Migrate existing single-service snapshots
INSERT INTO "appointment_booked_services" (
    "id",
    "appointment_id",
    "service_id",
    "service_name",
    "service_category",
    "service_duration_in_minutes",
    "service_price_in_cents",
    "position"
)
SELECT
    gen_random_uuid(),
    "id",
    "booked_service_id",
    "booked_service_name",
    "booked_service_category",
    "booked_service_duration_in_minutes",
    "booked_service_price_in_cents",
    0
FROM "appointments";

-- DropForeignKey
ALTER TABLE "appointments" DROP CONSTRAINT "appointments_booked_service_id_fkey";

-- DropIndex
DROP INDEX "appointments_booked_service_id_idx";

-- AlterTable
ALTER TABLE "appointments" DROP COLUMN "booked_service_id",
DROP COLUMN "booked_service_name",
DROP COLUMN "booked_service_category",
DROP COLUMN "booked_service_duration_in_minutes",
DROP COLUMN "booked_service_price_in_cents";

-- CreateIndex
CREATE INDEX "appointment_booked_services_appointment_id_idx" ON "appointment_booked_services"("appointment_id");

-- CreateIndex
CREATE INDEX "appointment_booked_services_service_id_idx" ON "appointment_booked_services"("service_id");

-- CreateIndex
CREATE INDEX "appointment_booked_services_service_id_service_name_idx" ON "appointment_booked_services"("service_id", "service_name");

-- CreateIndex
CREATE UNIQUE INDEX "appointment_booked_services_appointment_id_service_id_key" ON "appointment_booked_services"("appointment_id", "service_id");

-- AddForeignKey
ALTER TABLE "appointment_booked_services" ADD CONSTRAINT "appointment_booked_services_appointment_id_fkey" FOREIGN KEY ("appointment_id") REFERENCES "appointments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "appointment_booked_services" ADD CONSTRAINT "appointment_booked_services_service_id_fkey" FOREIGN KEY ("service_id") REFERENCES "services"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
