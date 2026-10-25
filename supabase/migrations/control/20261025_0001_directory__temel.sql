-- Kontrol düzlemi (07 §2): ofis dizini, shard eşlemesi, kullanıcının ofisleri, sistem genelinde VKN tekilliği.
-- Kullanıcıların kimliği GoTrue'dadır (auth şeması, aynı veritabanı). Bu tablolara yalnız sunucu (eworks_control) erişir;
-- tarayıcı veritabanına hiç bağlanmaz, bu yüzden RLS yerine yetki (grant) sınırı kullanılır.

do $$ begin
  if not exists (select from pg_roles where rolname = 'eworks_control') then
    create role eworks_control login;
  end if;
end $$;

create schema if not exists directory;
revoke all on schema directory from public;
grant usage on schema directory to eworks_control;

create table if not exists directory.shards (
  id text primary key check (id ~ '^shard-[0-9]{2}$'),
  accepting boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists directory.organizations (
  id uuid primary key,
  name text not null check (length(name) between 1 and 200),
  shard_id text not null references directory.shards(id),
  status text not null default 'active' check (status in ('active', 'frozen')),
  created_at timestamptz not null default now()
);
create index if not exists organizations_shard_idx on directory.organizations(shard_id);

-- Kullanıcının hangi ofislerde olduğu (giriş sonrası ofis seçimi). Yetkinin kendisi shard'daki üyeliktedir.
create table if not exists directory.user_orgs (
  user_id uuid not null,
  org_id uuid not null references directory.organizations(id),
  primary key (user_id, org_id)
);

-- VKN/TCKN tekilliği (D16, 07 §2.2): kimliğin HMAC özeti tutulur, kendisi değil.
create table if not exists directory.taxpayer_registry (
  tax_id_hash text primary key,
  org_id uuid not null references directory.organizations(id),
  firm_id uuid,
  state text not null check (state in ('reserved', 'active')),
  reserved_until timestamptz,
  updated_at timestamptz not null default now()
);

grant select, insert, update, delete on all tables in schema directory to eworks_control;
