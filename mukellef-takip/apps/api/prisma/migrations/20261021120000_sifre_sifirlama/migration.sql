-- "Şifremi unuttum": e-posta / SMS ile 6 haneli kod (identity). Kodun HMAC özeti saklanır.
-- AlterTable
ALTER TABLE "User" ADD COLUMN     "passwordResetAttempts" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "passwordResetExpires" TIMESTAMP(3),
ADD COLUMN     "passwordResetHash" TEXT,
ADD COLUMN     "passwordResetSentAt" TIMESTAMP(3);

