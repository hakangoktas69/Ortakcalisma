-- CreateEnum
CREATE TYPE "NotificationCategory" AS ENUM ('TEBLIGAT', 'SGK_RAPOR', 'BEYANNAME_SON_GUN', 'BEYANNAME_GECIKTI', 'SISTEM');

-- CreateEnum
CREATE TYPE "DeliveryChannel" AS ENUM ('WHATSAPP');

-- CreateEnum
CREATE TYPE "DeliveryStatus" AS ENUM ('QUEUED', 'SENT', 'FAILED');

-- CreateEnum
CREATE TYPE "TebligatSource" AS ENUM ('EXTENSION', 'DEMO');

-- AlterTable
ALTER TABLE "Notification" DROP COLUMN "isRead",
ADD COLUMN     "category" "NotificationCategory" NOT NULL DEFAULT 'SISTEM',
ADD COLUMN     "dedupeKey" TEXT,
ADD COLUMN     "link" TEXT;

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "notifyCategories" "NotificationCategory"[] DEFAULT ARRAY['TEBLIGAT', 'SGK_RAPOR', 'BEYANNAME_SON_GUN', 'BEYANNAME_GECIKTI']::"NotificationCategory"[],
ADD COLUMN     "phone" TEXT,
ADD COLUMN     "whatsappEnabled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "whatsappOptInAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "NotificationRead" (
    "notificationId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "readAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "NotificationRead_pkey" PRIMARY KEY ("notificationId","userId")
);

-- CreateTable
CREATE TABLE "NotificationDelivery" (
    "id" TEXT NOT NULL,
    "notificationId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "channel" "DeliveryChannel" NOT NULL,
    "status" "DeliveryStatus" NOT NULL DEFAULT 'QUEUED',
    "providerMessageId" TEXT,
    "error" TEXT,
    "sentAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "NotificationDelivery_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ETebligat" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "documentNo" TEXT NOT NULL,
    "sender" TEXT,
    "subject" TEXT,
    "deliveredAt" TIMESTAMP(3) NOT NULL,
    "deemedServedAt" TIMESTAMP(3) NOT NULL,
    "readAtGib" TIMESTAMP(3),
    "reviewedAt" TIMESTAMP(3),
    "reviewedById" TEXT,
    "source" "TebligatSource" NOT NULL,
    "raw" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ETebligat_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "NotificationDelivery_notificationId_userId_channel_key" ON "NotificationDelivery"("notificationId", "userId", "channel");

-- CreateIndex
CREATE INDEX "ETebligat_companyId_deliveredAt_idx" ON "ETebligat"("companyId", "deliveredAt");

-- CreateIndex
CREATE UNIQUE INDEX "ETebligat_companyId_documentNo_key" ON "ETebligat"("companyId", "documentNo");

-- CreateIndex
CREATE UNIQUE INDEX "Notification_tenantId_dedupeKey_key" ON "Notification"("tenantId", "dedupeKey");

-- AddForeignKey
ALTER TABLE "NotificationRead" ADD CONSTRAINT "NotificationRead_notificationId_fkey" FOREIGN KEY ("notificationId") REFERENCES "Notification"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NotificationRead" ADD CONSTRAINT "NotificationRead_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NotificationDelivery" ADD CONSTRAINT "NotificationDelivery_notificationId_fkey" FOREIGN KEY ("notificationId") REFERENCES "Notification"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NotificationDelivery" ADD CONSTRAINT "NotificationDelivery_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ETebligat" ADD CONSTRAINT "ETebligat_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

