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
    "legacyPerPoolRate" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_platform_settings" ("feeBasedBilling", "id", "paymentDevMode", "paypalEnabled", "stripeEnabled", "trialDays", "updatedAt") SELECT "feeBasedBilling", "id", "paymentDevMode", "paypalEnabled", "stripeEnabled", "trialDays", "updatedAt" FROM "platform_settings";
DROP TABLE "platform_settings";
ALTER TABLE "new_platform_settings" RENAME TO "platform_settings";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
