-- CreateTable
CREATE TABLE "platform_settings" (
    "id" TEXT NOT NULL PRIMARY KEY DEFAULT 'singleton',
    "trialDays" INTEGER NOT NULL DEFAULT 30,
    "updatedAt" DATETIME NOT NULL
);

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
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "company_packages_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "company_packages_packageId_fkey" FOREIGN KEY ("packageId") REFERENCES "packages" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_company_packages" ("companyId", "createdAt", "id", "packageId", "paidAt", "status", "trialEnd", "trialStart", "updatedAt") SELECT "companyId", "createdAt", "id", "packageId", "paidAt", "status", "trialEnd", "trialStart", "updatedAt" FROM "company_packages";
DROP TABLE "company_packages";
ALTER TABLE "new_company_packages" RENAME TO "company_packages";
CREATE UNIQUE INDEX "company_packages_companyId_key" ON "company_packages"("companyId");
CREATE INDEX "company_packages_companyId_idx" ON "company_packages"("companyId");
CREATE INDEX "company_packages_packageId_idx" ON "company_packages"("packageId");
CREATE TABLE "new_packages" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "price" INTEGER NOT NULL,
    "features" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_packages" ("createdAt", "features", "id", "name", "price", "slug", "sortOrder", "updatedAt") SELECT "createdAt", "features", "id", "name", "price", "slug", "sortOrder", "updatedAt" FROM "packages";
DROP TABLE "packages";
ALTER TABLE "new_packages" RENAME TO "packages";
CREATE UNIQUE INDEX "packages_slug_key" ON "packages"("slug");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

