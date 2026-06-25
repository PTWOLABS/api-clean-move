-- Rename password reset token hash column for magic-link semantics
ALTER TABLE "password_reset_tokens" RENAME COLUMN "hashed_code" TO "hashed_token";

CREATE INDEX "password_reset_tokens_hashed_token_idx" ON "password_reset_tokens"("hashed_token");
