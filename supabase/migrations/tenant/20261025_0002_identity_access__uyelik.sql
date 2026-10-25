-- organization + identity_access (05 §1, §3): ofis, müşavir, üyelik (rol), kişiye özel izin/engel.
-- Tüm kiracı tablolarında PK (org_id, …) ile başlar (07 §2.4, Citus'a hazır). user_id GoTrue'dadır (kontrol düzlemi), FK kurulmaz.

create schema if not exists organization;
create schema if not exists identity_access;
grant usage on schema organization, identity_access to authenticated;

create table organization.organizations (
  id uuid primary key,
  name text not null check (length(name) between 1 and 200),
  created_at timestamptz not null default now()
);

create table organization.advisors (
  org_id uuid not null references organization.organizations(id),
  id uuid not null,
  user_id uuid not null,
  title text not null check (length(title) between 1 and 200),
  primary key (org_id, id),
  unique (org_id, user_id)
);

create table identity_access.memberships (
  org_id uuid not null references organization.organizations(id),
  user_id uuid not null,
  role text not null check (role in ('ofis_admin', 'musavir', 'personel', 'mukellef')),
  display_name text not null check (length(display_name) between 1 and 200),
  created_at timestamptz not null default now(),
  primary key (org_id, user_id)
);

create table identity_access.permission_overrides (
  org_id uuid not null,
  user_id uuid not null,
  key text not null check (key ~ '^[a-z][a-z0-9_]*(\.[a-z][a-z0-9_]*)*$'),
  effect text not null check (effect in ('allow', 'deny')),
  granted_by uuid not null,
  granted_at timestamptz not null default now(),
  primary key (org_id, user_id, key),
  foreign key (org_id, user_id) references identity_access.memberships(org_id, user_id) on delete cascade
);

-- Üyelik denetimi RLS içinden çağrılır; özyinelemeyi önlemek için tanımlayıcı haklarıyla çalışır, yalnız boolean/rol döner.
create or replace function app.is_member(p_org uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select p_org = app.active_org() and exists (
    select 1 from identity_access.memberships m where m.org_id = p_org and m.user_id = app.uid())
$$;

create or replace function app.role_in(p_org uuid) returns text
language sql stable security definer set search_path = '' as $$
  select m.role from identity_access.memberships m where m.org_id = p_org and m.user_id = app.uid() and p_org = app.active_org()
$$;

revoke all on function app.is_member(uuid), app.role_in(uuid) from public;
grant execute on function app.is_member(uuid), app.role_in(uuid) to authenticated;

alter table organization.organizations enable row level security;
alter table organization.advisors enable row level security;
alter table identity_access.memberships enable row level security;
alter table identity_access.permission_overrides enable row level security;

-- Okuma: ofis üyeleri ve o ofisle sınırlı sistem bağlamı. Yazma: şimdilik yalnız sistem (hesap açma; yönetim ekranı kırmızı).
create policy oku on organization.organizations for select to authenticated using (app.is_member(id) or app.is_system(id));
create policy yaz on organization.organizations for insert to authenticated with check (app.is_system(id));
create policy oku on organization.advisors for select to authenticated using (app.is_member(org_id) or app.is_system(org_id));
create policy yaz on organization.advisors for insert to authenticated with check (app.is_system(org_id));
create policy oku on identity_access.memberships for select to authenticated using (app.is_member(org_id) or app.is_system(org_id));
create policy yaz on identity_access.memberships for insert to authenticated with check (app.is_system(org_id));
-- Kişiye özel izinleri kişinin kendisi ve ofis yöneticisi görür
create policy oku on identity_access.permission_overrides for select to authenticated
  using ((user_id = app.uid() and app.is_member(org_id)) or app.role_in(org_id) = 'ofis_admin' or app.is_system(org_id));
create policy yaz on identity_access.permission_overrides for insert to authenticated with check (app.is_system(org_id));

grant select, insert on all tables in schema organization, identity_access to authenticated;
