-- CreateEnum
CREATE TYPE "PayrollSource" AS ENUM ('EXCEL_UPLOAD', 'DEMO');

-- CreateTable
CREATE TABLE "PayrollRun" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "workplaceId" TEXT,
    "workplaceKey" TEXT NOT NULL,
    "period" TEXT NOT NULL,
    "source" "PayrollSource" NOT NULL,
    "fileName" TEXT,
    "employeeCount" INTEGER NOT NULL,
    "totalDays" INTEGER NOT NULL,
    "gross" DECIMAL(16,2) NOT NULL,
    "sgkBase" DECIMAL(16,2) NOT NULL,
    "employeeSgk" DECIMAL(16,2) NOT NULL,
    "employeeUnemployment" DECIMAL(16,2) NOT NULL,
    "employerSgk" DECIMAL(16,2),
    "employerUnemployment" DECIMAL(16,2),
    "incomeTax" DECIMAL(16,2) NOT NULL,
    "stampTax" DECIMAL(16,2) NOT NULL,
    "net" DECIMAL(16,2) NOT NULL,
    "warningCount" INTEGER NOT NULL DEFAULT 0,
    "uploadedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PayrollRun_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PayrollLine" (
    "id" TEXT NOT NULL,
    "runId" TEXT NOT NULL,
    "tckn" TEXT NOT NULL,
    "fullName" TEXT NOT NULL,
    "days" INTEGER NOT NULL,
    "gross" DECIMAL(14,2) NOT NULL,
    "sgkBase" DECIMAL(14,2) NOT NULL,
    "employeeSgk" DECIMAL(14,2) NOT NULL,
    "employeeUnemployment" DECIMAL(14,2) NOT NULL,
    "employerSgk" DECIMAL(14,2),
    "employerUnemployment" DECIMAL(14,2),
    "incomeTaxBase" DECIMAL(14,2),
    "incomeTax" DECIMAL(14,2) NOT NULL,
    "stampTax" DECIMAL(14,2) NOT NULL,
    "net" DECIMAL(14,2) NOT NULL,
    "warnings" TEXT[] DEFAULT ARRAY[]::TEXT[],

    CONSTRAINT "PayrollLine_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PayrollRun_period_idx" ON "PayrollRun"("period");

-- CreateIndex
CREATE UNIQUE INDEX "PayrollRun_companyId_workplaceKey_period_key" ON "PayrollRun"("companyId", "workplaceKey", "period");

-- CreateIndex
CREATE INDEX "PayrollLine_runId_idx" ON "PayrollLine"("runId");

-- AddForeignKey
ALTER TABLE "PayrollRun" ADD CONSTRAINT "PayrollRun_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PayrollRun" ADD CONSTRAINT "PayrollRun_workplaceId_fkey" FOREIGN KEY ("workplaceId") REFERENCES "SgkWorkplace"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PayrollLine" ADD CONSTRAINT "PayrollLine_runId_fkey" FOREIGN KEY ("runId") REFERENCES "PayrollRun"("id") ON DELETE CASCADE ON UPDATE CASCADE;

