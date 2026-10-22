-- CreateTable
CREATE TABLE "SalesUser" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "fullName" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "mustChangePassword" BOOLEAN NOT NULL DEFAULT true,
    "sessionVersion" INTEGER NOT NULL DEFAULT 0,
    "lastLoginAt" TIMESTAMP(3),
    "failedLogins" INTEGER NOT NULL DEFAULT 0,
    "lockedUntil" TIMESTAMP(3),
    "totpSecretEnc" TEXT,
    "totpEnabledAt" TIMESTAMP(3),
    "totpLastStep" INTEGER,
    "recoveryCodeHashes" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SalesUser_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SalesAccount" (
    "tenantId" TEXT NOT NULL,
    "contactName" TEXT NOT NULL,
    "contactEmail" TEXT NOT NULL,
    "contactPhone" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "trialEndsAt" TIMESTAMP(3),
    "suspendedAt" TIMESTAMP(3),
    "suspendedUserIds" TEXT[] DEFAULT ARRAY[]::TEXT[],

    CONSTRAINT "SalesAccount_pkey" PRIMARY KEY ("tenantId")
);

-- CreateTable
CREATE TABLE "SalesAuditLog" (
    "id" TEXT NOT NULL,
    "salesUserId" TEXT,
    "action" TEXT NOT NULL,
    "target" TEXT,
    "detail" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "seq" BIGSERIAL NOT NULL,
    "prevHash" TEXT,
    "hash" TEXT,

    CONSTRAINT "SalesAuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "SalesUser_email_key" ON "SalesUser"("email");

-- CreateIndex
CREATE UNIQUE INDEX "SalesAuditLog_seq_key" ON "SalesAuditLog"("seq");

-- CreateIndex
CREATE INDEX "SalesAuditLog_target_createdAt_idx" ON "SalesAuditLog"("target", "createdAt");

-- AddForeignKey
ALTER TABLE "SalesAccount" ADD CONSTRAINT "SalesAccount_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- ─── Erişim (docs/adr/0006-satis-modulu.md) ─────────────────────────────────────────────────────
-- Satış tabloları yalnız satış rolüne açıktır. app_user (müşavir API'si ve worker) bunları göremez;
-- önceki migration'daki ALTER DEFAULT PRIVILEGES onlara da yetki verdiği için burada geri alınır.
REVOKE ALL ON "SalesUser", "SalesAccount", "SalesAuditLog" FROM app_user;
REVOKE ALL ON SEQUENCE "SalesAuditLog_seq_seq" FROM app_user;

-- sales_user: satis/api'nin yetki rolü (NOLOGIN). Giriş rolü mukellef_satis bunun üyesidir
-- (infra/docker/postgres/init/01-roles.sh). Yetkiler tekrar çalıştırılabilir bir fonksiyonda: rolü oluşturma
-- yetkisi olmayan kurulumda (mukellef_owner NOCREATEROLE, rol önceden yok) migration yalnız uyarı verir;
-- yönetici `CREATE ROLE sales_user NOLOGIN; SELECT sales_grant_access();` ile tamamlar.
CREATE OR REPLACE FUNCTION sales_grant_access() RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  GRANT USAGE ON SCHEMA public TO sales_user;

  -- Kendi tabloları; işlem kaydı yalnız eklenir ve okunur
  GRANT SELECT, INSERT, UPDATE ON "SalesUser", "SalesAccount" TO sales_user;
  GRANT SELECT, INSERT ON "SalesAuditLog" TO sales_user;
  GRANT USAGE, SELECT ON SEQUENCE "SalesAuditLog_seq_seq" TO sales_user;

  -- Büro hesabı açma ve yönetme: büro, kullanıcıları, lisans
  GRANT SELECT, INSERT, UPDATE ON "Tenant", "User", "Subscription" TO sales_user;
  -- Büronun denetim kaydına satış işlemlerini ekler (değiştiremez, silemez)
  GRANT SELECT, INSERT ON "AuditLog" TO sales_user;
  EXECUTE format('GRANT USAGE, SELECT ON SEQUENCE %s TO sales_user', pg_get_serial_sequence('"AuditLog"', 'seq'));
  -- Mükellef verisi görülmez: yalnız sayım için kimlik, büro ve durum kolonu
  GRANT SELECT ("id", "tenantId", "isActive") ON "Company" TO sales_user;

  -- RLS: bu tablolar FORCE ROW LEVEL SECURITY; satış rolü büro bağlamı kurmadan tüm büroları yönetir.
  -- Hangi tabloya ve kolona erişebildiği yukarıdaki GRANT'larla sınırlıdır.
  DROP POLICY IF EXISTS sales_access ON "Tenant";
  CREATE POLICY sales_access ON "Tenant" TO sales_user USING (true) WITH CHECK (true);
  DROP POLICY IF EXISTS sales_access ON "User";
  CREATE POLICY sales_access ON "User" TO sales_user USING (true) WITH CHECK (true);
  DROP POLICY IF EXISTS sales_access ON "Subscription";
  CREATE POLICY sales_access ON "Subscription" TO sales_user USING (true) WITH CHECK (true);
  DROP POLICY IF EXISTS sales_access ON "AuditLog";
  CREATE POLICY sales_access ON "AuditLog" TO sales_user USING (true) WITH CHECK (true);
  DROP POLICY IF EXISTS sales_access ON "Company";
  CREATE POLICY sales_access ON "Company" FOR SELECT TO sales_user USING (true);
END $$;

REVOKE ALL ON FUNCTION sales_grant_access() FROM PUBLIC;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'sales_user') THEN
    BEGIN
      CREATE ROLE sales_user NOLOGIN NOSUPERUSER NOBYPASSRLS;
    EXCEPTION WHEN insufficient_privilege THEN
      RAISE WARNING 'sales_user rolü oluşturulamadı; yönetici: CREATE ROLE sales_user NOLOGIN; SELECT sales_grant_access();';
      RETURN;
    END;
  END IF;
  PERFORM sales_grant_access();
END $$;
