-- AlterTable
ALTER TABLE "ApiToken" ADD COLUMN     "expiresAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "AuditLog" ADD COLUMN     "hash" TEXT,
ADD COLUMN     "prevHash" TEXT,
ADD COLUMN     "seq" BIGSERIAL NOT NULL;

-- AlterTable
ALTER TABLE "EmploymentEvent" ADD COLUMN     "fullNameEnc" TEXT,
ADD COLUMN     "tcknEnc" TEXT,
ADD COLUMN     "tcknHash" TEXT,
ALTER COLUMN "tckn" DROP NOT NULL,
ALTER COLUMN "fullName" DROP NOT NULL;

-- AlterTable
ALTER TABLE "Notification" ADD COLUMN     "externalBody" TEXT;

-- AlterTable
ALTER TABLE "PayrollLine" ADD COLUMN     "fullNameEnc" TEXT,
ADD COLUMN     "tcknEnc" TEXT,
ADD COLUMN     "tcknHash" TEXT,
ALTER COLUMN "tckn" DROP NOT NULL,
ALTER COLUMN "fullName" DROP NOT NULL;

-- AlterTable
ALTER TABLE "SgkReport" ADD COLUMN     "fullNameEnc" TEXT,
ADD COLUMN     "tcknEnc" TEXT,
ADD COLUMN     "tcknHash" TEXT,
ALTER COLUMN "tckn" DROP NOT NULL,
ALTER COLUMN "fullName" DROP NOT NULL;

-- AlterTable
ALTER TABLE "Tenant" ADD COLUMN     "assistantConsentAt" TIMESTAMP(3),
ADD COLUMN     "assistantConsentById" TEXT;

-- CreateTable
CREATE TABLE "Session" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "familyId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "sessionVersion" INTEGER NOT NULL,
    "userAgent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastUsedAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "replacedAt" TIMESTAMP(3),
    "revokedAt" TIMESTAMP(3),
    "revokeReason" TEXT,

    CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OutboxEvent" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "availableAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "processedAt" TIMESTAMP(3),
    "lastError" TEXT,

    CONSTRAINT "OutboxEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Session_tokenHash_key" ON "Session"("tokenHash");

-- CreateIndex
CREATE INDEX "Session_familyId_idx" ON "Session"("familyId");

-- CreateIndex
CREATE INDEX "Session_userId_createdAt_idx" ON "Session"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "OutboxEvent_processedAt_availableAt_idx" ON "OutboxEvent"("processedAt", "availableAt");

-- CreateIndex
CREATE UNIQUE INDEX "AuditLog_seq_key" ON "AuditLog"("seq");

-- CreateIndex
CREATE INDEX "AuditLog_tenantId_seq_idx" ON "AuditLog"("tenantId", "seq");

-- CreateIndex
CREATE UNIQUE INDEX "EmploymentEvent_workplaceId_type_tcknHash_eventDate_key" ON "EmploymentEvent"("workplaceId", "type", "tcknHash", "eventDate");

-- AddForeignKey
ALTER TABLE "Session" ADD CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

