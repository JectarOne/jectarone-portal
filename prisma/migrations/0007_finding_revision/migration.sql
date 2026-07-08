-- CreateTable
CREATE TABLE "FindingRevision" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "findingId" TEXT NOT NULL,
    "userId" TEXT,
    "changes" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FindingRevision_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "FindingRevision_findingId_createdAt_idx" ON "FindingRevision"("findingId", "createdAt");

-- AddForeignKey
ALTER TABLE "FindingRevision" ADD CONSTRAINT "FindingRevision_findingId_fkey" FOREIGN KEY ("findingId") REFERENCES "Finding"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FindingRevision" ADD CONSTRAINT "FindingRevision_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

