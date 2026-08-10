-- CreateTable
CREATE TABLE "properties" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "address" TEXT,
    "notes" TEXT,
    "companyId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "properties_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_pools" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "address" TEXT,
    "volume" INTEGER NOT NULL,
    "image" TEXT,
    "qrCode" TEXT NOT NULL,
    "publicToken" TEXT NOT NULL,
    "homeownerEmail" TEXT,
    "homeownerPhone" TEXT,
    "notes" TEXT,
    "companyId" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "propertyId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "pools_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "pools_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "properties" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_pools" ("address", "companyId", "createdAt", "homeownerEmail", "homeownerPhone", "id", "image", "isActive", "name", "notes", "publicToken", "qrCode", "updatedAt", "volume") SELECT "address", "companyId", "createdAt", "homeownerEmail", "homeownerPhone", "id", "image", "isActive", "name", "notes", "publicToken", "qrCode", "updatedAt", "volume" FROM "pools";
DROP TABLE "pools";
ALTER TABLE "new_pools" RENAME TO "pools";
CREATE UNIQUE INDEX "pools_qrCode_key" ON "pools"("qrCode");
CREATE UNIQUE INDEX "pools_publicToken_key" ON "pools"("publicToken");
CREATE INDEX "pools_companyId_idx" ON "pools"("companyId");
CREATE INDEX "pools_propertyId_idx" ON "pools"("propertyId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE INDEX "properties_companyId_idx" ON "properties"("companyId");
