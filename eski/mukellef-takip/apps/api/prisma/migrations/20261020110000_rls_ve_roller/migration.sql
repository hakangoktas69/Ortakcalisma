-- Satır düzeyi güvenlik (docs/adr/0004) ve uygulama rolü.
--
-- Uygulama veritabanına tablo sahibi olmayan bir rolle bağlanır (infra/docker/postgres/init: mukellef_app,
-- bu dosyadaki app_user rolünün üyesidir). Migration'ları tablo sahibi çalıştırır. Superuser RLS'e tabi
-- değildir: yerel geliştirmede superuser ile bağlanılırsa politikalar devreye girmez (e2e testleri app rolüyle koşar).
--
-- Bağlam: uygulama her bağlantı alışında app.tenant_id ve app.bypass_rls ayarlarını yazar
-- (apps/api/src/platform/database/rls-pool.ts). Ayar yoksa hiçbir tenant satırı görünmez.

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'app_user') THEN
    CREATE ROLE app_user NOLOGIN NOSUPERUSER NOBYPASSRLS;
  END IF;
END $$;

GRANT USAGE ON SCHEMA public TO app_user;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO app_user;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO app_user;
-- Sonraki migration'larda oluşacak tablolar için de (bu migration'ı çalıştıran rolün oluşturdukları)
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO app_user;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT USAGE, SELECT ON SEQUENCES TO app_user;

REVOKE ALL ON "_prisma_migrations" FROM app_user;
-- Denetim kaydı değiştirilemez: uygulama yalnız ekler ve okur
REVOKE UPDATE, DELETE, TRUNCATE ON "AuditLog" FROM app_user;

CREATE OR REPLACE FUNCTION app_tenant() RETURNS text
  LANGUAGE sql STABLE AS $$ SELECT nullif(current_setting('app.tenant_id', true), '') $$;

CREATE OR REPLACE FUNCTION app_bypass() RETURNS boolean
  LANGUAGE sql STABLE AS $$ SELECT coalesce(current_setting('app.bypass_rls', true), 'off') = 'on' $$;

-- tenantId kolonu olan tablolar
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['User', 'Subscription', 'Company', 'ApiToken', 'Payment', 'AuditLog', 'Notification',
                           'AssistantConversation', 'AssistantMessage', 'InboxSnooze', 'OutboxEvent', 'Session'] LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY', t);
    EXECUTE format('CREATE POLICY tenant_isolation ON %I USING (app_bypass() OR "tenantId" = app_tenant()) WITH CHECK (app_bypass() OR "tenantId" = app_tenant())', t);
  END LOOP;
END $$;

ALTER TABLE "Tenant" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Tenant" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "Tenant"
  USING (app_bypass() OR id = app_tenant()) WITH CHECK (app_bypass() OR id = app_tenant());

-- Firma (mükellef) üzerinden büroya bağlı tablolar
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['CompanyObligation', 'Declaration', 'EDefterBerat', 'Petition', 'ETebligat', 'SgkWorkplace',
                           'Invoice', 'PayrollRun'] LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY', t);
    EXECUTE format($p$CREATE POLICY tenant_isolation ON %I
      USING (app_bypass() OR EXISTS (SELECT 1 FROM "Company" c WHERE c.id = "companyId" AND c."tenantId" = app_tenant()))
      WITH CHECK (app_bypass() OR EXISTS (SELECT 1 FROM "Company" c WHERE c.id = "companyId" AND c."tenantId" = app_tenant()))$p$, t);
  END LOOP;
END $$;

-- SGK işyeri üzerinden büroya bağlı tablolar
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['SgkReport', 'EmploymentEvent', 'EBildirgeDocument'] LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY', t);
    EXECUTE format($p$CREATE POLICY tenant_isolation ON %I
      USING (app_bypass() OR EXISTS (SELECT 1 FROM "SgkWorkplace" w JOIN "Company" c ON c.id = w."companyId"
                                     WHERE w.id = "workplaceId" AND c."tenantId" = app_tenant()))
      WITH CHECK (app_bypass() OR EXISTS (SELECT 1 FROM "SgkWorkplace" w JOIN "Company" c ON c.id = w."companyId"
                                          WHERE w.id = "workplaceId" AND c."tenantId" = app_tenant()))$p$, t);
  END LOOP;
END $$;

ALTER TABLE "PayrollLine" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "PayrollLine" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "PayrollLine"
  USING (app_bypass() OR EXISTS (SELECT 1 FROM "PayrollRun" r JOIN "Company" c ON c.id = r."companyId"
                                 WHERE r.id = "runId" AND c."tenantId" = app_tenant()))
  WITH CHECK (app_bypass() OR EXISTS (SELECT 1 FROM "PayrollRun" r JOIN "Company" c ON c.id = r."companyId"
                                      WHERE r.id = "runId" AND c."tenantId" = app_tenant()));

-- Bildirim üzerinden büroya bağlı tablolar
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['NotificationRead', 'NotificationDelivery'] LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY', t);
    EXECUTE format($p$CREATE POLICY tenant_isolation ON %I
      USING (app_bypass() OR EXISTS (SELECT 1 FROM "Notification" n WHERE n.id = "notificationId" AND n."tenantId" = app_tenant()))
      WITH CHECK (app_bypass() OR EXISTS (SELECT 1 FROM "Notification" n WHERE n.id = "notificationId" AND n."tenantId" = app_tenant()))$p$, t);
  END LOOP;
END $$;

-- Dilekçe şablonları: sistem şablonları (tenantId boş) herkese okunur; yazma yalnız büronun kendi şablonuna
ALTER TABLE "PetitionTemplate" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "PetitionTemplate" FORCE ROW LEVEL SECURITY;
CREATE POLICY template_read ON "PetitionTemplate" FOR SELECT
  USING (app_bypass() OR "tenantId" IS NULL OR "tenantId" = app_tenant());
CREATE POLICY template_insert ON "PetitionTemplate" FOR INSERT
  WITH CHECK (app_bypass() OR "tenantId" = app_tenant());
CREATE POLICY template_update ON "PetitionTemplate" FOR UPDATE
  USING (app_bypass() OR "tenantId" = app_tenant()) WITH CHECK (app_bypass() OR "tenantId" = app_tenant());
CREATE POLICY template_delete ON "PetitionTemplate" FOR DELETE
  USING (app_bypass() OR "tenantId" = app_tenant());

-- TaxCalendarEvent tüm bürolar için ortaktır (RLS yok).
