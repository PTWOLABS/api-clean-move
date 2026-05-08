-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('CUSTOMER', 'ESTABLISHMENT', 'ADMIN');

-- CreateEnum
CREATE TYPE "OAuthProvider" AS ENUM ('GOOGLE');

-- CreateEnum
CREATE TYPE "ServiceCategory" AS ENUM ('WASH', 'SANITIZATION', 'AUTOMATIVE_DETAILING', 'PROTECTION', 'UPHOLSTERY');

-- CreateEnum
CREATE TYPE "AppointmentStatus" AS ENUM ('AWAITING_PAYMENT', 'EXPIRED', 'IN_PROGRESS', 'FINISHED', 'CANCELLED', 'SCHEDULED');

-- CreateEnum
CREATE TYPE "PaymentMethod" AS ENUM ('PIX');

-- CreateEnum
CREATE TYPE "PaymentStatus" AS ENUM ('INITIATED', 'PENDING', 'PAID', 'EXPIRED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "CheckoutRecoveryReason" AS ENUM ('PAYMENT_CREATION_FAILED', 'PAYMENT_GATEWAY_FAILED');

-- CreateEnum
CREATE TYPE "CheckoutRecoveryStatus" AS ENUM ('PENDING', 'RESOLVED');

-- CreateTable
CREATE TABLE "users" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "hashed_password" TEXT,
    "role" "UserRole" NOT NULL,
    "phone" VARCHAR(11),
    "address" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "social_accounts" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "provider" "OAuthProvider" NOT NULL,
    "subject_id" TEXT NOT NULL,

    CONSTRAINT "social_accounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "password_reset_tokens" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "hashed_code" TEXT NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "password_reset_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "customers" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "cpf" VARCHAR(11) NOT NULL,

    CONSTRAINT "customers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "establishments" (
    "id" UUID NOT NULL,
    "owner_id" UUID NOT NULL,
    "corporate_name" TEXT NOT NULL,
    "social_reason" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "cnpj" VARCHAR(14) NOT NULL,

    CONSTRAINT "establishments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "services" (
    "id" UUID NOT NULL,
    "establishment_id" UUID NOT NULL,
    "service_name" VARCHAR(72) NOT NULL,
    "description" TEXT NOT NULL,
    "category" "ServiceCategory" NOT NULL,
    "estimated_duration_min_in_minutes" INTEGER NOT NULL,
    "estimated_duration_max_in_minutes" INTEGER NOT NULL,
    "price_in_cents" INTEGER NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "services_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "appointments" (
    "id" UUID NOT NULL,
    "establishment_id" UUID NOT NULL,
    "customer_id" UUID NOT NULL,
    "booked_by_customer" BOOLEAN NOT NULL DEFAULT false,
    "booked_service_id" UUID NOT NULL,
    "booked_service_name" VARCHAR(72) NOT NULL,
    "booked_service_category" "ServiceCategory" NOT NULL,
    "booked_service_duration_in_minutes" INTEGER NOT NULL,
    "booked_service_price_in_cents" INTEGER NOT NULL,
    "starts_at" TIMESTAMP(3) NOT NULL,
    "ends_at" TIMESTAMP(3) NOT NULL,
    "status" "AppointmentStatus" NOT NULL DEFAULT 'SCHEDULED',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "confirmed_at" TIMESTAMP(3),
    "cancelled_at" TIMESTAMP(3),
    "expired_at" TIMESTAMP(3),
    "reservation_expires_at" TIMESTAMP(3),

    CONSTRAINT "appointments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payments" (
    "id" UUID NOT NULL,
    "appointment_id" UUID NOT NULL,
    "customer_id" UUID NOT NULL,
    "establishment_id" UUID NOT NULL,
    "payment_method" "PaymentMethod" NOT NULL DEFAULT 'PIX',
    "amount_in_cents" INTEGER NOT NULL,
    "provider_name" TEXT,
    "provider_payment_id" TEXT,
    "pix_qr_code" TEXT,
    "pix_copy_paste_code" TEXT,
    "pix_expires_at" TIMESTAMP(3),
    "status" "PaymentStatus" NOT NULL DEFAULT 'INITIATED',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "paid_at" TIMESTAMP(3),
    "expired_at" TIMESTAMP(3),
    "cancelled_at" TIMESTAMP(3),

    CONSTRAINT "payments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "checkout_recoveries" (
    "id" UUID NOT NULL,
    "appointment_id" UUID NOT NULL,
    "payment_id" UUID,
    "reason" "CheckoutRecoveryReason" NOT NULL,
    "appointment_compensation_pending" BOOLEAN NOT NULL,
    "payment_compensation_pending" BOOLEAN NOT NULL,
    "failure_message" TEXT NOT NULL,
    "status" "CheckoutRecoveryStatus" NOT NULL DEFAULT 'PENDING',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolved_at" TIMESTAMP(3),

    CONSTRAINT "checkout_recoveries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "favorite_establishments" (
    "id" UUID NOT NULL,
    "customer_id" UUID NOT NULL,
    "establishment_id" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "favorite_establishments_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE INDEX "users_role_idx" ON "users"("role");

-- CreateIndex
CREATE INDEX "social_accounts_user_id_idx" ON "social_accounts"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "social_accounts_provider_subject_id_key" ON "social_accounts"("provider", "subject_id");

-- CreateIndex
CREATE UNIQUE INDEX "password_reset_tokens_user_id_key" ON "password_reset_tokens"("user_id");

-- CreateIndex
CREATE INDEX "password_reset_tokens_expires_at_idx" ON "password_reset_tokens"("expires_at");

-- CreateIndex
CREATE UNIQUE INDEX "customers_user_id_key" ON "customers"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "customers_cpf_key" ON "customers"("cpf");

-- CreateIndex
CREATE UNIQUE INDEX "establishments_owner_id_key" ON "establishments"("owner_id");

-- CreateIndex
CREATE UNIQUE INDEX "establishments_slug_key" ON "establishments"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "establishments_cnpj_key" ON "establishments"("cnpj");

-- CreateIndex
CREATE INDEX "establishments_corporate_name_idx" ON "establishments"("corporate_name");

-- CreateIndex
CREATE INDEX "services_establishment_id_idx" ON "services"("establishment_id");

-- CreateIndex
CREATE INDEX "services_establishment_id_service_name_idx" ON "services"("establishment_id", "service_name");

-- CreateIndex
CREATE INDEX "services_establishment_id_category_idx" ON "services"("establishment_id", "category");

-- CreateIndex
CREATE INDEX "services_establishment_id_price_in_cents_idx" ON "services"("establishment_id", "price_in_cents");

-- CreateIndex
CREATE INDEX "appointments_establishment_id_idx" ON "appointments"("establishment_id");

-- CreateIndex
CREATE INDEX "appointments_customer_id_idx" ON "appointments"("customer_id");

-- CreateIndex
CREATE INDEX "appointments_booked_service_id_idx" ON "appointments"("booked_service_id");

-- CreateIndex
CREATE INDEX "appointments_establishment_id_starts_at_ends_at_idx" ON "appointments"("establishment_id", "starts_at", "ends_at");

-- CreateIndex
CREATE INDEX "appointments_customer_id_created_at_idx" ON "appointments"("customer_id", "created_at");

-- CreateIndex
CREATE INDEX "appointments_establishment_id_created_at_idx" ON "appointments"("establishment_id", "created_at");

-- CreateIndex
CREATE INDEX "appointments_customer_id_status_idx" ON "appointments"("customer_id", "status");

-- CreateIndex
CREATE INDEX "appointments_establishment_id_status_idx" ON "appointments"("establishment_id", "status");

-- CreateIndex
CREATE INDEX "payments_appointment_id_idx" ON "payments"("appointment_id");

-- CreateIndex
CREATE INDEX "payments_customer_id_idx" ON "payments"("customer_id");

-- CreateIndex
CREATE INDEX "payments_establishment_id_idx" ON "payments"("establishment_id");

-- CreateIndex
CREATE INDEX "payments_status_pix_expires_at_idx" ON "payments"("status", "pix_expires_at");

-- CreateIndex
CREATE UNIQUE INDEX "payments_provider_name_provider_payment_id_key" ON "payments"("provider_name", "provider_payment_id");

-- CreateIndex
CREATE INDEX "checkout_recoveries_appointment_id_idx" ON "checkout_recoveries"("appointment_id");

-- CreateIndex
CREATE INDEX "checkout_recoveries_payment_id_idx" ON "checkout_recoveries"("payment_id");

-- CreateIndex
CREATE INDEX "checkout_recoveries_status_idx" ON "checkout_recoveries"("status");

-- CreateIndex
CREATE INDEX "favorite_establishments_customer_id_idx" ON "favorite_establishments"("customer_id");

-- CreateIndex
CREATE INDEX "favorite_establishments_establishment_id_idx" ON "favorite_establishments"("establishment_id");

-- CreateIndex
CREATE UNIQUE INDEX "favorite_establishments_customer_id_establishment_id_key" ON "favorite_establishments"("customer_id", "establishment_id");

-- AddForeignKey
ALTER TABLE "social_accounts" ADD CONSTRAINT "social_accounts_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "password_reset_tokens" ADD CONSTRAINT "password_reset_tokens_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "customers" ADD CONSTRAINT "customers_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "establishments" ADD CONSTRAINT "establishments_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "services" ADD CONSTRAINT "services_establishment_id_fkey" FOREIGN KEY ("establishment_id") REFERENCES "establishments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "appointments" ADD CONSTRAINT "appointments_establishment_id_fkey" FOREIGN KEY ("establishment_id") REFERENCES "establishments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "appointments" ADD CONSTRAINT "appointments_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "appointments" ADD CONSTRAINT "appointments_booked_service_id_fkey" FOREIGN KEY ("booked_service_id") REFERENCES "services"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_appointment_id_fkey" FOREIGN KEY ("appointment_id") REFERENCES "appointments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_establishment_id_fkey" FOREIGN KEY ("establishment_id") REFERENCES "establishments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "checkout_recoveries" ADD CONSTRAINT "checkout_recoveries_appointment_id_fkey" FOREIGN KEY ("appointment_id") REFERENCES "appointments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "checkout_recoveries" ADD CONSTRAINT "checkout_recoveries_payment_id_fkey" FOREIGN KEY ("payment_id") REFERENCES "payments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "favorite_establishments" ADD CONSTRAINT "favorite_establishments_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "favorite_establishments" ADD CONSTRAINT "favorite_establishments_establishment_id_fkey" FOREIGN KEY ("establishment_id") REFERENCES "establishments"("id") ON DELETE CASCADE ON UPDATE CASCADE;
