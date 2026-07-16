-- AlterTable
ALTER TABLE "service_visits" ADD COLUMN "nextServiceDate" DATETIME;
ALTER TABLE "service_visits" ADD COLUMN "publicToken" TEXT;

-- AlterTable
ALTER TABLE "users" ADD COLUMN "supabaseId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "service_visits_publicToken_key" ON "service_visits"("publicToken");

-- CreateIndex
CREATE UNIQUE INDEX "users_supabaseId_key" ON "users"("supabaseId");
