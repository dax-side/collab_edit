-- Drop previous token unique index
DROP INDEX IF EXISTS "password_reset_tokens_token_key";

-- Migrate token column to hashed-token naming
ALTER TABLE "password_reset_tokens"
  RENAME COLUMN "token" TO "token_hash";

-- Remove expiry and usage tracking; tokens are valid until consumed
ALTER TABLE "password_reset_tokens"
  DROP COLUMN IF EXISTS "expires_at",
  DROP COLUMN IF EXISTS "used_at";

-- Enforce uniqueness on hashed token
CREATE UNIQUE INDEX "password_reset_tokens_token_hash_key" ON "password_reset_tokens"("token_hash");
