/*
  Warnings:

  - The required column `publicToken` was added to the `pools` table with a prisma-level default value. This is not possible if the table is not empty. Please add this column as optional, then populate it before making it required.

*/
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
    "notes" TEXT,
    "companyId" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "pools_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_pools" ("address", "companyId", "createdAt", "id", "image", "isActive", "name", "notes", "qrCode", "updatedAt", "volume") SELECT "address", "companyId", "createdAt", "id", "image", "isActive", "name", "notes", "qrCode", "updatedAt", "volume" FROM "pools";
DROP TABLE "pools";
ALTER TABLE "new_pools" RENAME TO "pools";
CREATE UNIQUE INDEX "pools_qrCode_key" ON "pools"("qrCode");
CREATE UNIQUE INDEX "pools_publicToken_key" ON "pools"("publicToken");
CREATE INDEX "pools_companyId_idx" ON "pools"("companyId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
