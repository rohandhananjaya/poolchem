-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_companies" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "logo" TEXT,
    "email" TEXT NOT NULL,
    "phone" TEXT,
    "address" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "stripeCustomerId" TEXT,
    "stripeSubscriptionId" TEXT,
    "subscriptionStatus" TEXT,
    "paypalSubscriptionId" TEXT,
    "paypalPlanId" TEXT,
    "stripeConnectAccountId" TEXT,
    "stripeConnectOnboarded" BOOLEAN NOT NULL DEFAULT false,
    "fromEmail" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_companies" ("active", "address", "createdAt", "email", "fromEmail", "id", "logo", "name", "paypalPlanId", "paypalSubscriptionId", "phone", "stripeCustomerId", "stripeSubscriptionId", "subscriptionStatus", "updatedAt") SELECT "active", "address", "createdAt", "email", "fromEmail", "id", "logo", "name", "paypalPlanId", "paypalSubscriptionId", "phone", "stripeCustomerId", "stripeSubscriptionId", "subscriptionStatus", "updatedAt" FROM "companies";
DROP TABLE "companies";
ALTER TABLE "new_companies" RENAME TO "companies";
CREATE UNIQUE INDEX "companies_stripeCustomerId_key" ON "companies"("stripeCustomerId");
CREATE UNIQUE INDEX "companies_stripeSubscriptionId_key" ON "companies"("stripeSubscriptionId");
CREATE UNIQUE INDEX "companies_paypalSubscriptionId_key" ON "companies"("paypalSubscriptionId");
CREATE UNIQUE INDEX "companies_stripeConnectAccountId_key" ON "companies"("stripeConnectAccountId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
