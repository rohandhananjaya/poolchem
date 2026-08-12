-- CreateTable
CREATE TABLE "visit_photos" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "serviceVisitPoolId" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "category" TEXT NOT NULL DEFAULT 'EQUIPMENT',
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "visit_photos_serviceVisitPoolId_fkey" FOREIGN KEY ("serviceVisitPoolId") REFERENCES "service_visit_pools" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "visit_photos_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "visit_photos_serviceVisitPoolId_idx" ON "visit_photos"("serviceVisitPoolId");

-- CreateIndex
CREATE INDEX "visit_photos_companyId_idx" ON "visit_photos"("companyId");
