-- Yeni enum değeri ayrı migrationda: PostgreSQL yeni değeri aynı işlem içinde kullanmaya izin vermez
ALTER TYPE "NotificationCategory" ADD VALUE IF NOT EXISTS 'EDEFTER';
