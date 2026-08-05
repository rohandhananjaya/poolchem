-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_service_visits" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "poolId" TEXT NOT NULL,
    "techId" TEXT,
    "notes" TEXT,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "paymentStatus" TEXT NOT NULL DEFAULT 'UNPAID',
    "weatherNotes" TEXT,
    "cancellationReason" TEXT,
    "publicToken" TEXT,
    "scheduledAt" DATETIME,
    "nextServiceDate" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "service_visits_poolId_fkey" FOREIGN KEY ("poolId") REFERENCES "pools" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "service_visits_techId_fkey" FOREIGN KEY ("techId") REFERENCES "users" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_service_visits" ("cancellationReason", "createdAt", "id", "nextServiceDate", "notes", "poolId", "publicToken", "scheduledAt", "status", "techId", "updatedAt", "weatherNotes") SELECT "cancellationReason", "createdAt", "id", "nextServiceDate", "notes", "poolId", "publicToken", "scheduledAt", "status", "techId", "updatedAt", "weatherNotes" FROM "service_visits";
DROP TABLE "service_visits";
ALTER TABLE "new_service_visits" RENAME TO "service_visits";
CREATE UNIQUE INDEX "service_visits_publicToken_key" ON "service_visits"("publicToken");
CREATE INDEX "service_visits_poolId_idx" ON "service_visits"("poolId");
CREATE INDEX "service_visits_techId_idx" ON "service_visits"("techId");
CREATE INDEX "service_visits_scheduledAt_idx" ON "service_visits"("scheduledAt");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
