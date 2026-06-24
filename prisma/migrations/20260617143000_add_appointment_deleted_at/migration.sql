ALTER TABLE "appointments" ADD COLUMN "deleted_at" TIMESTAMP(3);

CREATE INDEX "appointments_establishment_id_deleted_at_idx" ON "appointments"("establishment_id", "deleted_at");
