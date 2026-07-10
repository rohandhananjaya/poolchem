-- AlterTable
ALTER TABLE "service_visits" ADD COLUMN "scheduledAt" DATETIME;

-- CreateIndex
CREATE INDEX "service_visits_scheduledAt_idx" ON "service_visits"("scheduledAt");
