-- AlterTable
ALTER TABLE "companies" ADD COLUMN "paypalPlanId" TEXT;
ALTER TABLE "companies" ADD COLUMN "paypalSubscriptionId" TEXT;

-- AlterTable
ALTER TABLE "packages" ADD COLUMN "paypalPlanId" TEXT;
ALTER TABLE "packages" ADD COLUMN "stripePriceId" TEXT;

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_company_packages" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "companyId" TEXT NOT NULL,
    "packageId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'TRIAL',
    "trialStart" DATETIME,
    "trialEnd" DATETIME,
    "paidAt" DATETIME,
    "pendingPackageId" TEXT,
    "pendingEffectiveAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "company_packages_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "company_packages_packageId_fkey" FOREIGN KEY ("packageId") REFERENCES "packages" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "company_packages_pendingPackageId_fkey" FOREIGN KEY ("pendingPackageId") REFERENCES "packages" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_company_packages" ("companyId", "createdAt", "id", "packageId", "paidAt", "status", "trialEnd", "trialStart", "updatedAt") SELECT "companyId", "createdAt", "id", "packageId", "paidAt", "status", "trialEnd", "trialStart", "updatedAt" FROM "company_packages";
DROP TABLE "company_packages";
ALTER TABLE "new_company_packages" RENAME TO "company_packages";
CREATE UNIQUE INDEX "company_packages_companyId_key" ON "company_packages"("companyId");
CREATE INDEX "company_packages_companyId_idx" ON "company_packages"("companyId");
CREATE INDEX "company_packages_packageId_idx" ON "company_packages"("packageId");
CREATE INDEX "company_packages_pendingEffectiveAt_idx" ON "company_packages"("pendingEffectiveAt");
CREATE TABLE "new_platform_settings" (
    "id" TEXT NOT NULL PRIMARY KEY DEFAULT 'singleton',
    "trialDays" INTEGER NOT NULL DEFAULT 30,
    "stripeEnabled" BOOLEAN NOT NULL DEFAULT false,
    "paypalEnabled" BOOLEAN NOT NULL DEFAULT false,
    "paymentDevMode" BOOLEAN NOT NULL DEFAULT true,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_platform_settings" ("id", "trialDays", "stripeEnabled", "paypalEnabled", "paymentDevMode", "updatedAt") SELECT "id", "trialDays", "stripeEnabled", "paypalEnabled", "paymentDevMode", "updatedAt" FROM "platform_settings";
DROP TABLE "platform_settings";
ALTER TABLE "new_platform_settings" RENAME TO "platform_settings";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE UNIQUE INDEX "companies_paypalSubscriptionId_key" ON "companies"("paypalSubscriptionId");
