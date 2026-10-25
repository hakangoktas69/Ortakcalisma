-- CreateEnum
CREATE TYPE "InvoiceDirection" AS ENUM ('OUTGOING', 'INCOMING');

-- CreateEnum
CREATE TYPE "InvoiceSource" AS ENUM ('UBL_UPLOAD', 'DEMO');

-- CreateTable
CREATE TABLE "Invoice" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "direction" "InvoiceDirection" NOT NULL,
    "uuid" TEXT NOT NULL,
    "number" TEXT NOT NULL,
    "issueDate" DATE NOT NULL,
    "period" TEXT NOT NULL,
    "profile" TEXT NOT NULL,
    "invoiceType" TEXT NOT NULL,
    "counterpartyTaxNumber" TEXT,
    "counterpartyName" TEXT,
    "currency" TEXT NOT NULL DEFAULT 'TRY',
    "exchangeRate" DECIMAL(14,6),
    "lineExtensionAmount" DECIMAL(16,2) NOT NULL,
    "taxExclusiveAmount" DECIMAL(16,2) NOT NULL,
    "taxInclusiveAmount" DECIMAL(16,2) NOT NULL,
    "payableAmount" DECIMAL(16,2) NOT NULL,
    "vatAmount" DECIMAL(16,2) NOT NULL,
    "withholdingAmount" DECIMAL(16,2) NOT NULL DEFAULT 0,
    "taxes" JSONB NOT NULL,
    "lineCount" INTEGER NOT NULL,
    "source" "InvoiceSource" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Invoice_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Invoice_companyId_period_idx" ON "Invoice"("companyId", "period");

-- CreateIndex
CREATE UNIQUE INDEX "Invoice_companyId_direction_uuid_key" ON "Invoice"("companyId", "direction", "uuid");

-- AddForeignKey
ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

