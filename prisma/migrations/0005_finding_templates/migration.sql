-- CreateTable
CREATE TABLE "FindingTemplate" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT,
    "title" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "severity" TEXT NOT NULL DEFAULT 'Medium',
    "likelihood" TEXT NOT NULL DEFAULT 'Medium',
    "impact" TEXT NOT NULL DEFAULT 'Medium',
    "cvssScore" DOUBLE PRECISION,
    "cvssVector" TEXT,
    "cwe" TEXT,
    "owaspCategory" TEXT,
    "mitreTechnique" TEXT,
    "description" TEXT,
    "businessImpact" TEXT,
    "remediation" TEXT,
    "references" TEXT,
    "createdById" TEXT,
    "archivedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FindingTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "FindingTemplate_organizationId_category_idx" ON "FindingTemplate"("organizationId", "category");

-- CreateIndex
CREATE INDEX "FindingTemplate_organizationId_archivedAt_idx" ON "FindingTemplate"("organizationId", "archivedAt");

-- AddForeignKey
ALTER TABLE "FindingTemplate" ADD CONSTRAINT "FindingTemplate_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

