-- sales (D27, D40): satış portalının kontrol düzlemi tabloları — satış kullanıcıları (portal kimliğinden/GoTrue'dan ayrı),
-- ofisin satış hesabı (yetkili, paket, deneme/lisans bitişi) ve hash zincirli satış denetim kaydı.
-- Satış uygulaması `eworks_sales` rolüyle bağlanır: yalnız bu şema + dizinde ofis açma (shard seçimi, ofis ve kullanıcı-ofis kaydı).
-- VKN dizinine (taxpayer_registry) erişimi yoktur; shard'larda tabloya değil yalnız hesap açma fonksiyonlarına erişir
-- (tenant/20261026_0013). Lisans bu aşamada yalnız kayıttır, portala girişi engellemez (D40).
-- Mevcut veride etki: yalnız yeni şema ve rol; var olan tablolara dokunulmaz. Geri dönüş: yeni migration ile.

do $$ begin
  if not exists (select from pg_roles where rolname = 'eworks_sales') then
    create role eworks_sales login;
  end if;
end $$;

create schema if not exists sales;
revoke all on schema sales from public;
grant usage on schema sales to eworks_sales;

create table if not exists sales.users (
  id uuid primary key,
  email text not null check (email = lower(email) and length(email) between 3 and 254),
  full_name text not null check (length(full_name) between 1 and 200),
  password_hash text not null,
  is_active boolean not null default true,
  failed_logins int not null default 0 check (failed_logins >= 0),
  locked_until timestamptz,
  totp_secret_enc text,
  totp_enabled_at timestamptz,
  totp_last_step bigint,
  recovery_code_hashes text[] not null default '{}',
  session_version int not null default 1,
  must_change_password boolean not null default true,
  created_at timestamptz not null default now(),
  constraint users_email_key unique (email),
  -- 2FA açıksa gizli anahtar vardır
  constraint users_totp_check check (totp_enabled_at is null or totp_secret_enc is not null)
);

-- Ofisin satış hesabı. Hesap açma komutuyla açılan ofisin (demo, kabul testi) satır yoktur: listede "süresiz" görünür.
create table if not exists sales.accounts (
  org_id uuid primary key references directory.organizations(id),
  contact_name text not null check (length(contact_name) between 1 and 200),
  contact_email text not null check (contact_email = lower(contact_email)),
  contact_phone text not null check (contact_phone ~ '^90[2-5][0-9]{9}$'),
  plan text not null check (plan in ('baslangic', 'pro', 'kurumsal')),
  trial_ends_at timestamptz,
  expires_at timestamptz,
  created_by uuid references sales.users(id),
  created_at timestamptz not null default now()
);

-- Satış denetim kaydı: sistem genelinde tek hash zinciri. Yazma yalnız sales.record() ile; güncelleme/silme yetkisi yok.
create table if not exists sales.audit_entries (
  id bigint generated always as identity primary key,
  at timestamptz not null default now(),
  sales_user_id uuid,
  action text not null check (action ~ '^[a-z_0-9]+(\.[a-z_0-9]+)+$'),
  subject text,
  details jsonb not null default '{}'::jsonb check (jsonb_typeof(details) = 'object' and octet_length(details::text) <= 4096),
  prev_hash text,
  hash text not null
);

create or replace function sales.record(p_user uuid, p_action text, p_subject text, p_details jsonb default '{}'::jsonb)
returns void language plpgsql security definer set search_path = '' as $$
declare
  v_prev text;
  v_at timestamptz := clock_timestamp();
begin
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('sales-audit', 0));
  select e.hash into v_prev from sales.audit_entries e order by e.id desc limit 1;
  insert into sales.audit_entries(at, sales_user_id, action, subject, details, prev_hash, hash)
  values (v_at, p_user, p_action, p_subject, coalesce(p_details, '{}'::jsonb), v_prev,
          encode(extensions.digest(concat_ws('|', v_prev, v_at::text, p_user::text, p_action, p_subject, coalesce(p_details, '{}'::jsonb)::text), 'sha256'), 'hex'));
end $$;

revoke all on function sales.record(uuid, text, text, jsonb) from public;
grant execute on function sales.record(uuid, text, text, jsonb) to eworks_sales;

grant select, insert, update on sales.users, sales.accounts to eworks_sales;
grant select on sales.audit_entries to eworks_sales;

-- Dizin: shard seçimi ve ofis açma. Ofis dondurma sonraki aşamada (satis.ofis.freeze) ayrı yetkiyle gelir.
grant usage on schema directory to eworks_sales;
grant select on directory.shards, directory.organizations to eworks_sales;
grant insert on directory.organizations, directory.user_orgs to eworks_sales;
