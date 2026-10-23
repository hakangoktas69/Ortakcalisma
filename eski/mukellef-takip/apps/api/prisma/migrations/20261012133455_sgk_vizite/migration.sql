-- CreateEnum
CREATE TYPE "SyncStatus" AS ENUM ('NEVER', 'RUNNING', 'OK', 'ERROR');

-- CreateEnum
CREATE TYPE "ReportStatus" AS ENUM ('PENDING', 'APPROVED');

-- AlterTable
ALTER TABLE "SgkWorkplace" ADD COLUMN     "credentialsUpdatedAt" TIMESTAMP(3),
ADD COLUMN     "lastSyncAt" TIMESTAMP(3),
ADD COLUMN     "lastSyncError" TEXT,
ADD COLUMN     "lastSyncStatus" "SyncStatus" NOT NULL DEFAULT 'NEVER',
ADD COLUMN     "viziteSecretEnc" TEXT,
ADD COLUMN     "viziteUsername" TEXT,
ADD COLUMN     "viziteWorkplaceCode" TEXT;

-- CreateTable
CREATE TABLE "SgkReport" (
    "id" TEXT NOT NULL,
    "workplaceId" TEXT NOT NULL,
    "medulaRaporId" TEXT NOT NULL,
    "tckn" TEXT NOT NULL,
    "fullName" TEXT NOT NULL,
    "vaka" INTEGER NOT NULL,
    "vakaAdi" TEXT,
    "policlinicDate" TIMESTAMP(3),
    "startDate" TIMESTAMP(3),
    "endDate" TIMESTAMP(3),
    "workControlDate" TIMESTAMP(3),
    "sgkStatusCode" TEXT,
    "facilityName" TEXT,
    "status" "ReportStatus" NOT NULL DEFAULT 'PENDING',
    "approvedAt" TIMESTAMP(3),
    "raw" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SgkReport_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "userId" TEXT,
    "action" TEXT NOT NULL,
    "target" TEXT,
    "detail" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SgkReport_workplaceId_status_idx" ON "SgkReport"("workplaceId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "SgkReport_workplaceId_medulaRaporId_key" ON "SgkReport"("workplaceId", "medulaRaporId");

-- CreateIndex
CREATE INDEX "AuditLog_tenantId_createdAt_idx" ON "AuditLog"("tenantId", "createdAt");

-- CreateIndex
CREATE INDEX "SgkWorkplace_companyId_idx" ON "SgkWorkplace"("companyId");

-- AddForeignKey
ALTER TABLE "SgkReport" ADD CONSTRAINT "SgkReport_workplaceId_fkey" FOREIGN KEY ("workplaceId") REFERENCES "SgkWorkplace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
