-- CreateEnum
CREATE TYPE "QuotePaymentMethod" AS ENUM ('CASH', 'PIX', 'CARD', 'OTHER');

-- CreateEnum
CREATE TYPE "QuoteDiscountType" AS ENUM ('PERCENTAGE', 'AMOUNT');

-- CreateTable
CREATE TABLE "quotes" (
    "id" UUID NOT NULL,
    "establishment_id" UUID NOT NULL,
    "customer_id" UUID,
    "vehicle_id" UUID,
    "converted_appointment_id" UUID,
    "converted_at" TIMESTAMP(3),
    "establishment_name" TEXT NOT NULL,
    "establishment_legal_business_name" TEXT NOT NULL,
    "establishment_cnpj" VARCHAR(14) NOT NULL,
    "establishment_address" JSONB,
    "establishment_banner_image_url" TEXT,
    "customer_name" TEXT NOT NULL,
    "customer_phone" VARCHAR(11),
    "customer_cpf_cnpj" VARCHAR(14),
    "customer_address" JSONB,
    "vehicle_plate" VARCHAR(12),
    "vehicle_brand" TEXT,
    "vehicle_model" TEXT,
    "vehicle_color" TEXT,
    "vehicle_year" INTEGER,
    "description" TEXT,
    "terms_and_conditions" TEXT,
    "expires_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "quotes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "quote_services" (
    "id" UUID NOT NULL,
    "quote_id" UUID NOT NULL,
    "service_id" UUID NOT NULL,
    "service_name" VARCHAR(72) NOT NULL,
    "service_category" "ServiceCategory",
    "service_duration_in_minutes" INTEGER,
    "service_price_in_cents" INTEGER NOT NULL,
    "is_courtesy" BOOLEAN NOT NULL DEFAULT false,
    "position" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "quote_services_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "quote_payment_options" (
    "id" UUID NOT NULL,
    "quote_id" UUID NOT NULL,
    "method" "QuotePaymentMethod" NOT NULL,
    "label" TEXT NOT NULL,
    "installments" INTEGER,
    "interest_free" BOOLEAN NOT NULL DEFAULT true,
    "discount_type" "QuoteDiscountType",
    "discount_value" INTEGER,
    "total_in_cents" INTEGER NOT NULL,
    "position" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "quote_payment_options_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "quotes_converted_appointment_id_key" ON "quotes"("converted_appointment_id");

-- CreateIndex
CREATE INDEX "quotes_establishment_id_idx" ON "quotes"("establishment_id");

-- CreateIndex
CREATE INDEX "quotes_establishment_id_created_at_idx" ON "quotes"("establishment_id", "created_at");

-- CreateIndex
CREATE INDEX "quotes_establishment_id_customer_id_idx" ON "quotes"("establishment_id", "customer_id");

-- CreateIndex
CREATE INDEX "quotes_establishment_id_vehicle_id_idx" ON "quotes"("establishment_id", "vehicle_id");

-- CreateIndex
CREATE INDEX "quotes_establishment_id_expires_at_idx" ON "quotes"("establishment_id", "expires_at");

-- CreateIndex
CREATE INDEX "quotes_establishment_id_converted_appointment_id_idx" ON "quotes"("establishment_id", "converted_appointment_id");

-- CreateIndex
CREATE INDEX "quote_services_quote_id_idx" ON "quote_services"("quote_id");

-- CreateIndex
CREATE INDEX "quote_services_service_id_idx" ON "quote_services"("service_id");

-- CreateIndex
CREATE UNIQUE INDEX "quote_services_quote_id_service_id_key" ON "quote_services"("quote_id", "service_id");

-- CreateIndex
CREATE INDEX "quote_payment_options_quote_id_idx" ON "quote_payment_options"("quote_id");

-- AddForeignKey
ALTER TABLE "quotes" ADD CONSTRAINT "quotes_establishment_id_fkey" FOREIGN KEY ("establishment_id") REFERENCES "establishments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quotes" ADD CONSTRAINT "quotes_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quotes" ADD CONSTRAINT "quotes_vehicle_id_fkey" FOREIGN KEY ("vehicle_id") REFERENCES "customer_vehicles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quotes" ADD CONSTRAINT "quotes_converted_appointment_id_fkey" FOREIGN KEY ("converted_appointment_id") REFERENCES "appointments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quote_services" ADD CONSTRAINT "quote_services_quote_id_fkey" FOREIGN KEY ("quote_id") REFERENCES "quotes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quote_services" ADD CONSTRAINT "quote_services_service_id_fkey" FOREIGN KEY ("service_id") REFERENCES "services"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quote_payment_options" ADD CONSTRAINT "quote_payment_options_quote_id_fkey" FOREIGN KEY ("quote_id") REFERENCES "quotes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- RenameIndex
ALTER INDEX "establishments_corporate_name_idx" RENAME TO "establishments_tradeName_idx";
