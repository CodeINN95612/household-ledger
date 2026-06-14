-- AlterTable
ALTER TABLE "Expense" ADD COLUMN "category" TEXT;
ALTER TABLE "Expense" ADD COLUMN "isRecurringFixed" BOOLEAN;

-- CreateTable
CREATE TABLE "Fund" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "scope" TEXT NOT NULL,
    "ownerUserId" TEXT,
    "targetCents" INTEGER,
    "targetDate" DATETIME,
    "isPrivate" BOOLEAN NOT NULL DEFAULT false,
    "isSinking" BOOLEAN NOT NULL DEFAULT false,
    "sinkingNote" TEXT,
    "archived" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "AllocationRule" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "fundId" TEXT NOT NULL,
    "percentBps" INTEGER NOT NULL,
    "fixedCentsOverride" INTEGER,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "AllocationRule_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "AllocationRule_fundId_fkey" FOREIGN KEY ("fundId") REFERENCES "Fund" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "FundEntry" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "fundId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "monthKey" TEXT NOT NULL,
    "amountCents" INTEGER NOT NULL,
    "kind" TEXT NOT NULL,
    "note" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "FundEntry_fundId_fkey" FOREIGN KEY ("fundId") REFERENCES "Fund" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "FundEntry_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "PlanAssumption" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT,
    "monthKey" TEXT,
    "kind" TEXT NOT NULL,
    "amountCents" INTEGER NOT NULL,
    "note" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "Scenario" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "createdByUserId" TEXT NOT NULL,
    "baseline" BOOLEAN NOT NULL DEFAULT false,
    "overridesJson" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "HouseholdSettings" (
    "id" TEXT NOT NULL PRIMARY KEY DEFAULT 'singleton',
    "frontingUserId" TEXT,
    "floatReserveCentsOverride" INTEGER,
    "coupleGoalSplitMode" TEXT NOT NULL DEFAULT 'proportional',
    "projectionHorizonMonths" INTEGER NOT NULL DEFAULT 12,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateIndex
CREATE INDEX "AllocationRule_userId_idx" ON "AllocationRule"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "AllocationRule_userId_fundId_key" ON "AllocationRule"("userId", "fundId");

-- CreateIndex
CREATE INDEX "FundEntry_fundId_monthKey_idx" ON "FundEntry"("fundId", "monthKey");

-- CreateIndex
CREATE INDEX "PlanAssumption_userId_monthKey_idx" ON "PlanAssumption"("userId", "monthKey");
