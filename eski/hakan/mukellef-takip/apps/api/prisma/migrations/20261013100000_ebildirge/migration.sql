-- CreateEnum
CREATE TYPE "EBildirgeSource" AS ENUM ('EXTENSION', 'DEMO');

-- CreateTable
CREATE TABLE "EBildirgeDocument" (
    "id" TEXT NOT NULL,
    "workplaceId" TEXT NOT NULL,
    "period" TEXT NOT NULL,
    "documentType" TEXT NOT NULL,
    "lawNo" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "insuredCount" INTEGER,
    "totalDays" INTEGER,
    "premiumBase" DECIMAL(14,2),
    "accrualAmount" DECIMAL(14,2),
    "approvedAt" TIMESTAMP(3),
    "referenceNo" TEXT,
    "source" "EBildirgeSource" NOT NULL,
    "raw" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EBildirgeDocument_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "EBildirgeDocument_workplaceId_period_idx" ON "EBildirgeDocument"("workplaceId", "period");

-- CreateIndex
CREATE UNIQUE INDEX "EBildirgeDocument_workplaceId_period_documentType_lawNo_kin_key" ON "EBildirgeDocument"("workplaceId", "period", "documentType", "lawNo", "kind");

-- AddForeignKey
ALTER TABLE "EBildirgeDocument" ADD CONSTRAINT "EBildirgeDocument_workplaceId_fkey" FOREIGN KEY ("workplaceId") REFERENCES "SgkWorkplace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

