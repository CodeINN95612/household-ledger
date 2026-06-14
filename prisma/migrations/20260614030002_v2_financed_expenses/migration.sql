-- CreateTable
CREATE TABLE "FinancedExpense" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "description" TEXT NOT NULL,
    "totalCents" INTEGER NOT NULL,
    "installments" INTEGER NOT NULL,
    "annualRateBps" INTEGER NOT NULL DEFAULT 0,
    "startMonthKey" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "paidByUserId" TEXT NOT NULL,
    "category" TEXT,
    "cancelledAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "FinancedExpense_paidByUserId_fkey" FOREIGN KEY ("paidByUserId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "FinancedExpense_startMonthKey_idx" ON "FinancedExpense"("startMonthKey");

-- CreateIndex
CREATE INDEX "FinancedExpense_paidByUserId_idx" ON "FinancedExpense"("paidByUserId");
