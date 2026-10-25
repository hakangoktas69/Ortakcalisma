-- Kiracı shard'ı temeli: uygulama rolleri ve RLS yardımcıları (app şeması). Her shard'a aynen uygulanır.
-- Giriş rolleri NOINHERIT'tir: tablolara yalnız `set local role authenticated` sonrası, RLS'e tabi erişirler (D34).
--   eworks_app          web/BFF — kullanıcı claim'leriyle
--   eworks_worker       arka plan işçisi — tek ofisle sınırlı sistem claim'iyle (app.is_system)
--   eworks_integration  Python ACL — yalnız iş için kurum hesabı sırrını okuyan fonksiyonu çağırır
do $$ begin
  if not exists (select from pg_roles where rolname = 'eworks_app') then create role eworks_app login noinherit; end if;
  if not exists (select from pg_roles where rolname = 'eworks_worker') then create role eworks_worker login noinherit; end if;
  if not exists (select from pg_roles where rolname = 'eworks_integration') then create role eworks_integration login noinherit; end if;
end $$;
grant authenticated to eworks_app, eworks_worker;

create schema if not exists app;
revoke all on schema app from public;
grant usage on schema app to authenticated, eworks_integration;

create or replace function app.claims() returns jsonb
language sql stable set search_path = '' as $$
  select coalesce(nullif(current_setting('request.jwt.claims', true), ''), '{}')::jsonb
$$;

create or replace function app.uid() returns uuid
language sql stable set search_path = '' as $$
  select case when app.claims()->>'role' = 'authenticated' then nullif(app.claims()->>'sub', '')::uuid end
$$;

-- Sistem bağlamı yalnız işçi giriş rolünde ve claim'deki tek ofis için geçerlidir; web rolü bunu taklit edemez.
create or replace function app.is_system(p_org uuid) returns boolean
language sql stable set search_path = '' as $$
  select session_user = 'eworks_worker' and app.claims()->>'role' = 'system' and app.claims()->>'org' = p_org::text
$$;

-- Etkin ofis (oturumda seçili). Kullanıcı sorguları bununla da sınırlanır.
create or replace function app.active_org() returns uuid
language sql stable set search_path = '' as $$
  select nullif(app.claims()->>'org', '')::uuid
$$;

grant execute on function app.claims(), app.uid(), app.is_system(uuid), app.active_org() to authenticated;
