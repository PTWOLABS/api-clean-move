-- AlterTable
ALTER TABLE "services" ADD COLUMN "deleted_at" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "services_establishment_id_deleted_at_idx" ON "services"("establishment_id", "deleted_at");
