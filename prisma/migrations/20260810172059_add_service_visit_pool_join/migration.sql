-- CreateTable
CREATE TABLE "service_visit_pools" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "serviceVisitId" TEXT NOT NULL,
    "poolId" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "service_visit_pools_serviceVisitId_fkey" FOREIGN KEY ("serviceVisitId") REFERENCES "service_visits" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "service_visit_pools_poolId_fkey" FOREIGN KEY ("poolId") REFERENCES "pools" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "service_visit_pools_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_chemicals_added" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "visitId" TEXT NOT NULL,
    "serviceVisitPoolId" TEXT,
    "name" TEXT NOT NULL,
    "amount" REAL NOT NULL,
    "unit" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "chemicals_added_visitId_fkey" FOREIGN KEY ("visitId") REFERENCES "service_visits" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "chemicals_added_serviceVisitPoolId_fkey" FOREIGN KEY ("serviceVisitPoolId") REFERENCES "service_visit_pools" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_chemicals_added" ("amount", "createdAt", "id", "name", "unit", "visitId") SELECT "amount", "createdAt", "id", "name", "unit", "visitId" FROM "chemicals_added";
DROP TABLE "chemicals_added";
ALTER TABLE "new_chemicals_added" RENAME TO "chemicals_added";
CREATE INDEX "chemicals_added_visitId_idx" ON "chemicals_added"("visitId");
CREATE INDEX "chemicals_added_serviceVisitPoolId_idx" ON "chemicals_added"("serviceVisitPoolId");
CREATE TABLE "new_water_readings" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "visitId" TEXT NOT NULL,
    "serviceVisitPoolId" TEXT,
    "ph" REAL NOT NULL,
    "freeChlorine" REAL NOT NULL,
    "totalAlkalinity" REAL NOT NULL,
    "calciumHardness" REAL NOT NULL,
    "cyanuricAcid" REAL NOT NULL,
    "temperature" REAL NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "water_readings_visitId_fkey" FOREIGN KEY ("visitId") REFERENCES "service_visits" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "water_readings_serviceVisitPoolId_fkey" FOREIGN KEY ("serviceVisitPoolId") REFERENCES "service_visit_pools" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_water_readings" ("calciumHardness", "createdAt", "cyanuricAcid", "freeChlorine", "id", "ph", "temperature", "totalAlkalinity", "visitId") SELECT "calciumHardness", "createdAt", "cyanuricAcid", "freeChlorine", "id", "ph", "temperature", "totalAlkalinity", "visitId" FROM "water_readings";
DROP TABLE "water_readings";
ALTER TABLE "new_water_readings" RENAME TO "water_readings";
CREATE INDEX "water_readings_visitId_idx" ON "water_readings"("visitId");
CREATE INDEX "water_readings_serviceVisitPoolId_idx" ON "water_readings"("serviceVisitPoolId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE INDEX "service_visit_pools_poolId_idx" ON "service_visit_pools"("poolId");

-- CreateIndex
CREATE INDEX "service_visit_pools_companyId_idx" ON "service_visit_pools"("companyId");

-- CreateIndex
CREATE UNIQUE INDEX "service_visit_pools_serviceVisitId_poolId_key" ON "service_visit_pools"("serviceVisitId", "poolId");
