/*
  Warnings:

  - The values [AWAITING_PAYMENT,EXPIRED,IN_PROGRESS,FINISHED] on the enum `AppointmentStatus` will be removed. If these variants are still used in the database, this will fail.
  - You are about to drop the column `booked_by_customer` on the `appointments` table. All the data in the column will be lost.
  - You are about to drop the column `confirmed_at` on the `appointments` table. All the data in the column will be lost.
  - You are about to drop the column `expired_at` on the `appointments` table. All the data in the column will be lost.
  - You are about to drop the column `reservation_expires_at` on the `appointments` table. All the data in the column will be lost.
  - You are about to drop the column `cpf` on the `customers` table. All the data in the column will be lost.
  - You are about to drop the column `user_id` on the `customers` table. All the data in the column will be lost.
  - You are about to drop the `checkout_recoveries` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `favorite_establishments` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `payments` table. If the table is not empty, all the data it contains will be lost.
  - Added the required column `email` to the `customers` table without a default value. This is not possible if the table is not empty.
  - Added the required column `establishment_id` to the `customers` table without a default value. This is not possible if the table is not empty.
  - Added the required column `full_name` to the `customers` table without a default value. This is not possible if the table is not empty.
  - Added the required column `phone` to the `customers` table without a default value. This is not possible if the table is not empty.

*/
-- AlterEnum
BEGIN;
CREATE TYPE "AppointmentStatus_new" AS ENUM ('SCHEDULED', 'DONE', 'CANCELLED');
ALTER TABLE "public"."appointments" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "appointments" ALTER COLUMN "status" TYPE "AppointmentStatus_new" USING ("status"::text::"AppointmentStatus_new");
ALTER TYPE "AppointmentStatus" RENAME TO "AppointmentStatus_old";
ALTER TYPE "AppointmentStatus_new" RENAME TO "AppointmentStatus";
DROP TYPE "public"."AppointmentStatus_old";
ALTER TABLE "appointments" ALTER COLUMN "status" SET DEFAULT 'SCHEDULED';
COMMIT;

-- DropForeignKey
ALTER TABLE "checkout_recoveries" DROP CONSTRAINT "checkout_recoveries_appointment_id_fkey";

-- DropForeignKey
ALTER TABLE "checkout_recoveries" DROP CONSTRAINT "checkout_recoveries_payment_id_fkey";

-- DropForeignKey
ALTER TABLE "customers" DROP CONSTRAINT "customers_user_id_fkey";

-- DropForeignKey
ALTER TABLE "favorite_establishments" DROP CONSTRAINT "favorite_establishments_customer_id_fkey";

-- DropForeignKey
ALTER TABLE "favorite_establishments" DROP CONSTRAINT "favorite_establishments_establishment_id_fkey";

-- DropForeignKey
ALTER TABLE "payments" DROP CONSTRAINT "payments_appointment_id_fkey";

-- DropForeignKey
ALTER TABLE "payments" DROP CONSTRAINT "payments_customer_id_fkey";

-- DropForeignKey
ALTER TABLE "payments" DROP CONSTRAINT "payments_establishment_id_fkey";

-- DropIndex
DROP INDEX "appointments_customer_id_created_at_idx";

-- DropIndex
DROP INDEX "appointments_customer_id_status_idx";

-- DropIndex
DROP INDEX "appointments_establishment_id_created_at_idx";

-- DropIndex
DROP INDEX "appointments_establishment_id_starts_at_ends_at_idx";

-- DropIndex
DROP INDEX "customers_cpf_key";

-- DropIndex
DROP INDEX "customers_user_id_key";

-- AlterTable
ALTER TABLE "appointments" DROP COLUMN "booked_by_customer",
DROP COLUMN "confirmed_at",
DROP COLUMN "expired_at",
DROP COLUMN "reservation_expires_at",
ADD COLUMN     "description" TEXT,
ADD COLUMN     "discount_in_cents" INTEGER,
ADD COLUMN     "done_at" TIMESTAMP(3),
ADD COLUMN     "vehicle_brand" TEXT,
ADD COLUMN     "vehicle_color" TEXT,
ADD COLUMN     "vehicle_id" UUID,
ADD COLUMN     "vehicle_model" TEXT,
ADD COLUMN     "vehicle_plate" VARCHAR(12),
ADD COLUMN     "vehicle_year" INTEGER,
ALTER COLUMN "booked_service_category" DROP NOT NULL,
ALTER COLUMN "booked_service_duration_in_minutes" DROP NOT NULL,
ALTER COLUMN "ends_at" DROP NOT NULL;

-- AlterTable
ALTER TABLE "customers" DROP COLUMN "cpf",
DROP COLUMN "user_id",
ADD COLUMN     "address" JSONB,
ADD COLUMN     "birth_date" TIMESTAMP(3),
ADD COLUMN     "cpf_cnpj" VARCHAR(14),
ADD COLUMN     "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "deleted_at" TIMESTAMP(3),
ADD COLUMN     "email" TEXT NOT NULL,
ADD COLUMN     "establishment_id" UUID NOT NULL,
ADD COLUMN     "full_name" TEXT NOT NULL,
ADD COLUMN     "nickname" TEXT,
ADD COLUMN     "phone" VARCHAR(11) NOT NULL,
ADD COLUMN     "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- DropTable
DROP TABLE "checkout_recoveries";

-- DropTable
DROP TABLE "favorite_establishments";

-- DropTable
DROP TABLE "payments";

-- DropEnum
DROP TYPE "CheckoutRecoveryReason";

-- DropEnum
DROP TYPE "CheckoutRecoveryStatus";

-- DropEnum
DROP TYPE "PaymentMethod";

-- DropEnum
DROP TYPE "PaymentStatus";

-- CreateTable
CREATE TABLE "customer_vehicles" (
    "id" UUID NOT NULL,
    "establishment_id" UUID NOT NULL,
    "customer_id" UUID NOT NULL,
    "plate" VARCHAR(12),
    "brand" TEXT,
    "model" TEXT,
    "color" TEXT,
    "year" INTEGER,
    "notes" TEXT,
    "deleted_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "customer_vehicles_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "customer_vehicles_establishment_id_idx" ON "customer_vehicles"("establishment_id");

-- CreateIndex
CREATE INDEX "customer_vehicles_customer_id_idx" ON "customer_vehicles"("customer_id");

-- CreateIndex
CREATE INDEX "customer_vehicles_establishment_id_plate_idx" ON "customer_vehicles"("establishment_id", "plate");

-- CreateIndex
CREATE INDEX "customer_vehicles_establishment_id_deleted_at_idx" ON "customer_vehicles"("establishment_id", "deleted_at");

-- CreateIndex
CREATE INDEX "appointments_vehicle_id_idx" ON "appointments"("vehicle_id");

-- CreateIndex
CREATE INDEX "appointments_establishment_id_starts_at_idx" ON "appointments"("establishment_id", "starts_at");

-- CreateIndex
CREATE INDEX "appointments_establishment_id_customer_id_idx" ON "appointments"("establishment_id", "customer_id");

-- CreateIndex
CREATE INDEX "appointments_establishment_id_vehicle_id_idx" ON "appointments"("establishment_id", "vehicle_id");

-- CreateIndex
CREATE INDEX "customers_establishment_id_idx" ON "customers"("establishment_id");

-- CreateIndex
CREATE INDEX "customers_establishment_id_full_name_idx" ON "customers"("establishment_id", "full_name");

-- CreateIndex
CREATE INDEX "customers_establishment_id_phone_idx" ON "customers"("establishment_id", "phone");

-- CreateIndex
CREATE INDEX "customers_establishment_id_email_idx" ON "customers"("establishment_id", "email");

-- CreateIndex
CREATE INDEX "customers_establishment_id_deleted_at_idx" ON "customers"("establishment_id", "deleted_at");

-- AddForeignKey
ALTER TABLE "customers" ADD CONSTRAINT "customers_establishment_id_fkey" FOREIGN KEY ("establishment_id") REFERENCES "establishments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "customer_vehicles" ADD CONSTRAINT "customer_vehicles_establishment_id_fkey" FOREIGN KEY ("establishment_id") REFERENCES "establishments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "customer_vehicles" ADD CONSTRAINT "customer_vehicles_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "appointments" ADD CONSTRAINT "appointments_vehicle_id_fkey" FOREIGN KEY ("vehicle_id") REFERENCES "customer_vehicles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE UNIQUE INDEX "customers_establishment_cpf_cnpj_active_unique"
ON "customers"("establishment_id", "cpf_cnpj")
WHERE "cpf_cnpj" IS NOT NULL AND "deleted_at" IS NULL;

CREATE UNIQUE INDEX "customer_vehicles_establishment_plate_active_unique"
ON "customer_vehicles"("establishment_id", "plate")
WHERE "plate" IS NOT NULL AND "deleted_at" IS NULL;
