-- AlterTable
ALTER TABLE "Payment" ADD COLUMN     "fraudStatus" INTEGER,
ADD COLUMN     "providerToken" TEXT;

-- AlterTable
ALTER TABLE "Tenant" ADD COLUMN     "billingAddress" TEXT,
ADD COLUMN     "billingCity" TEXT,
ADD COLUMN     "billingContactName" TEXT,
ADD COLUMN     "billingEmail" TEXT,
ADD COLUMN     "billingName" TEXT,
ADD COLUMN     "billingPhone" TEXT,
ADD COLUMN     "billingTaxNumber" TEXT,
ADD COLUMN     "billingTaxOffice" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Payment_providerToken_key" ON "Payment"("providerToken");

