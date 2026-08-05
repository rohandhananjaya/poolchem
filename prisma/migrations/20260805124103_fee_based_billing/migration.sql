-- CreateTable
CREATE TABLE "payment_transactions" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "companyId" TEXT NOT NULL,
    "visitId" TEXT,
    "amount" INTEGER NOT NULL,
    "feePercent" INTEGER NOT NULL DEFAULT 0,
    "feeAmount" INTEGER NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "paidAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "payment_transactions_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_platform_settings" (
    "id" TEXT NOT NULL PRIMARY KEY DEFAULT 'singleton',
    "trialDays" INTEGER NOT NULL DEFAULT 30,
    "stripeEnabled" BOOLEAN NOT NULL DEFAULT false,
    "paypalEnabled" BOOLEAN NOT NULL DEFAULT false,
    "paymentDevMode" BOOLEAN NOT NULL DEFAULT true,
    "feeBasedBilling" BOOLEAN NOT NULL DEFAULT false,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_platform_settings" ("id", "paymentDevMode", "paypalEnabled", "stripeEnabled", "trialDays", "updatedAt") SELECT "id", "paymentDevMode", "paypalEnabled", "stripeEnabled", "trialDays", "updatedAt" FROM "platform_settings";
DROP TABLE "platform_settings";
ALTER TABLE "new_platform_settings" RENAME TO "platform_settings";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE INDEX "payment_transactions_companyId_createdAt_idx" ON "payment_transactions"("companyId", "createdAt");
