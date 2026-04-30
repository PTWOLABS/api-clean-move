-- AlterEnum
ALTER TYPE "UserRole" ADD VALUE 'EMPLOYEE';

-- AlterTable
ALTER TABLE "establishments" ADD COLUMN     "profile_image_url" TEXT;

-- CreateTable
CREATE TABLE "employees" (
    "id" UUID NOT NULL,
    "establishment_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "profile_image_url" TEXT,
    "name" TEXT,
    "cpf" VARCHAR(11),
    "birth_date" TIMESTAMP(3),
    "features" TEXT[] DEFAULT ARRAY['read:services', 'read:appointments', 'read:customers']::TEXT[],
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "employees_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "employees_user_id_key" ON "employees"("user_id");

-- CreateIndex
CREATE INDEX "employees_establishment_id_idx" ON "employees"("establishment_id");

-- AddForeignKey
ALTER TABLE "employees" ADD CONSTRAINT "employees_establishment_id_fkey" FOREIGN KEY ("establishment_id") REFERENCES "establishments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employees" ADD CONSTRAINT "employees_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
