-- CreateTable
CREATE TABLE "password_change_confirmation_codes" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "hashed_code" TEXT NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "password_change_confirmation_codes_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "password_change_confirmation_codes_user_id_key" ON "password_change_confirmation_codes"("user_id");

-- CreateIndex
CREATE INDEX "password_change_confirmation_codes_expires_at_idx" ON "password_change_confirmation_codes"("expires_at");

-- AddForeignKey
ALTER TABLE "password_change_confirmation_codes" ADD CONSTRAINT "password_change_confirmation_codes_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
