-- AlterTable: add waterMl to DailyNutritionSummary
ALTER TABLE "DailyNutritionSummary" ADD COLUMN "waterMl" DOUBLE PRECISION NOT NULL DEFAULT 0;

-- CreateTable: WeightEntry
CREATE TABLE "WeightEntry" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "weightKg" DOUBLE PRECISION NOT NULL,
    "notes" TEXT,
    "loggedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WeightEntry_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "WeightEntry_userId_loggedAt_idx" ON "WeightEntry"("userId", "loggedAt");

-- AddForeignKey
ALTER TABLE "WeightEntry" ADD CONSTRAINT "WeightEntry_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
