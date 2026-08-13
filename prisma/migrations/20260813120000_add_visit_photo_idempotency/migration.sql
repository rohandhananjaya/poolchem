-- AlterTable
ALTER TABLE "visit_photos" ADD COLUMN "clientMutationId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "visit_photos_clientMutationId_key" ON "visit_photos"("clientMutationId");
