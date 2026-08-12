-- CreateTable
CREATE TABLE "CustomMeal" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CustomMeal_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CustomMealItem" (
    "id" TEXT NOT NULL,
    "customMealId" TEXT NOT NULL,
    "foodId" TEXT NOT NULL,
    "servingCount" DOUBLE PRECISION NOT NULL,

    CONSTRAINT "CustomMealItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CustomMeal_userId_idx" ON "CustomMeal"("userId");

-- AddForeignKey
ALTER TABLE "CustomMeal" ADD CONSTRAINT "CustomMeal_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CustomMealItem" ADD CONSTRAINT "CustomMealItem_customMealId_fkey" FOREIGN KEY ("customMealId") REFERENCES "CustomMeal"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CustomMealItem" ADD CONSTRAINT "CustomMealItem_foodId_fkey" FOREIGN KEY ("foodId") REFERENCES "Food"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
