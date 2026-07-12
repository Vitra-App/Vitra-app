-- Add Apple In-App Purchase (StoreKit2) fields to SubscriptionStatus
ALTER TABLE "SubscriptionStatus" ADD COLUMN IF NOT EXISTS "platform" TEXT DEFAULT 'web';
ALTER TABLE "SubscriptionStatus" ADD COLUMN IF NOT EXISTS "appleOriginalTransactionId" TEXT;
ALTER TABLE "SubscriptionStatus" ADD COLUMN IF NOT EXISTS "appleProductId" TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS "SubscriptionStatus_appleOriginalTransactionId_key"
  ON "SubscriptionStatus"("appleOriginalTransactionId");
