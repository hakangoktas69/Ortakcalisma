-- CreateEnum
CREATE TYPE "DeclarationType" AS ENUM ('KDV1', 'MUHSGK', 'DAMGA', 'GECICI_VERGI', 'YILLIK_GELIR', 'KURUMLAR');

-- CreateEnum
CREATE TYPE "DeclarationSource" AS ENUM ('MANUAL', 'GIB');

-- CreateTable
CREATE TABLE "CompanyObligation" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "type" "DeclarationType" NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "CompanyObligation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Declaration" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "type" "DeclarationType" NOT NULL,
    "period" TEXT NOT NULL,
    "filedAt" TIMESTAMP(3) NOT NULL,
    "accrualAmount" DECIMAL(14,2),
    "referenceNo" TEXT,
    "source" "DeclarationSource" NOT NULL,
    "note" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Declaration_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "CompanyObligation_companyId_type_key" ON "CompanyObligation"("companyId", "type");

-- CreateIndex
CREATE INDEX "Declaration_type_period_idx" ON "Declaration"("type", "period");

-- CreateIndex
CREATE UNIQUE INDEX "Declaration_companyId_type_period_key" ON "Declaration"("companyId", "type", "period");

-- AddForeignKey
ALTER TABLE "CompanyObligation" ADD CONSTRAINT "CompanyObligation_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Declaration" ADD CONSTRAINT "Declaration_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
