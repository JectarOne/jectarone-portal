-- AlterTable
ALTER TABLE "Evidence" ADD COLUMN     "retestId" TEXT;

-- CreateTable
CREATE TABLE "Retest" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "findingId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'Requested',
    "requestedById" TEXT,
    "assignedToId" TEXT,
    "dueDate" TIMESTAMP(3),
    "scheduledFor" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "result" TEXT,
    "consultantNotes" TEXT,
    "clientNotes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Retest_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Retest_organizationId_status_idx" ON "Retest"("organizationId", "status");

-- CreateIndex
CREATE INDEX "Retest_findingId_createdAt_idx" ON "Retest"("findingId", "createdAt");

-- CreateIndex
CREATE INDEX "Evidence_retestId_idx" ON "Evidence"("retestId");

-- AddForeignKey
ALTER TABLE "Retest" ADD CONSTRAINT "Retest_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Retest" ADD CONSTRAINT "Retest_findingId_fkey" FOREIGN KEY ("findingId") REFERENCES "Finding"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Retest" ADD CONSTRAINT "Retest_requestedById_fkey" FOREIGN KEY ("requestedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Retest" ADD CONSTRAINT "Retest_assignedToId_fkey" FOREIGN KEY ("assignedToId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Evidence" ADD CONSTRAINT "Evidence_retestId_fkey" FOREIGN KEY ("retestId") REFERENCES "Retest"("id") ON DELETE SET NULL ON UPDATE CASCADE;

