-- CreateEnum
CREATE TYPE "EmploymentEventType" AS ENUM ('ENTRY', 'EXIT');

-- AlterTable
ALTER TABLE "SgkWorkplace" ADD COLUMN     "tescilCredentialsUpdatedAt" TIMESTAMP(3),
ADD COLUMN     "tescilLastSyncAt" TIMESTAMP(3),
ADD COLUMN     "tescilLastSyncError" TEXT,
ADD COLUMN     "tescilLastSyncStatus" "SyncStatus" NOT NULL DEFAULT 'NEVER',
ADD COLUMN     "tescilSystemPasswordEnc" TEXT,
ADD COLUMN     "tescilUsername" TEXT,
ADD COLUMN     "tescilWorkplacePasswordEnc" TEXT;

-- CreateTable
CREATE TABLE "EmploymentEvent" (
    "id" TEXT NOT NULL,
    "workplaceId" TEXT NOT NULL,
    "type" "EmploymentEventType" NOT NULL,
    "tckn" TEXT NOT NULL,
    "fullName" TEXT NOT NULL,
    "eventDate" TIMESTAMP(3) NOT NULL,
    "insuranceType" TEXT,
    "occupationCode" TEXT,
    "exitReasonCode" TEXT,
    "exitReason" TEXT,
    "referenceNo" TEXT,
    "raw" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EmploymentEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "EmploymentEvent_workplaceId_type_eventDate_idx" ON "EmploymentEvent"("workplaceId", "type", "eventDate");

-- CreateIndex
CREATE UNIQUE INDEX "EmploymentEvent_workplaceId_type_tckn_eventDate_key" ON "EmploymentEvent"("workplaceId", "type", "tckn", "eventDate");

-- AddForeignKey
ALTER TABLE "EmploymentEvent" ADD CONSTRAINT "EmploymentEvent_workplaceId_fkey" FOREIGN KEY ("workplaceId") REFERENCES "SgkWorkplace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
