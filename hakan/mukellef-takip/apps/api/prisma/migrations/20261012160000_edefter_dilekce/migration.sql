-- CreateEnum
CREATE TYPE "EDefterPreference" AS ENUM ('MONTHLY', 'QUARTERLY');

-- AlterTable
ALTER TABLE "Company" ADD COLUMN     "eDefterEnabled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "eDefterPreference" "EDefterPreference" NOT NULL DEFAULT 'MONTHLY';

-- CreateTable
CREATE TABLE "EDefterBerat" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "period" TEXT NOT NULL,
    "uploadedAt" TIMESTAMP(3),
    "dueDateOverride" TIMESTAMP(3),
    "note" TEXT,
    "updatedById" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EDefterBerat_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PetitionTemplate" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT,
    "title" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PetitionTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Petition" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "templateId" TEXT,
    "title" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Petition_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "EDefterBerat_companyId_period_key" ON "EDefterBerat"("companyId", "period");

-- CreateIndex
CREATE INDEX "PetitionTemplate_tenantId_idx" ON "PetitionTemplate"("tenantId");

-- CreateIndex
CREATE INDEX "Petition_companyId_createdAt_idx" ON "Petition"("companyId", "createdAt");

-- AddForeignKey
ALTER TABLE "EDefterBerat" ADD CONSTRAINT "EDefterBerat_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Petition" ADD CONSTRAINT "Petition_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Petition" ADD CONSTRAINT "Petition_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "PetitionTemplate"("id") ON DELETE SET NULL ON UPDATE CASCADE;

