-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_packages" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "price" INTEGER NOT NULL,
    "feePercent" INTEGER NOT NULL DEFAULT 0,
    "features" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "stripePriceId" TEXT,
    "paypalPlanId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_packages" ("createdAt", "features", "id", "name", "paypalPlanId", "price", "slug", "sortOrder", "stripePriceId", "updatedAt") SELECT "createdAt", "features", "id", "name", "paypalPlanId", "price", "slug", "sortOrder", "stripePriceId", "updatedAt" FROM "packages";
DROP TABLE "packages";
ALTER TABLE "new_packages" RENAME TO "packages";
CREATE UNIQUE INDEX "packages_slug_key" ON "packages"("slug");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
