-- portfolio: mükellef (firma) kartı, tek müşavir bağı (D16), personel ataması, mükellef kullanıcıları (05 §1–§2).
-- Görünürlük app.can_see_firm(): ofis yöneticisi tüm firmalar; müşavir kendi portföyü; personel atandığı firmalar;
-- mükellef bağlı olduğu firmalar (05 §3.2 kapsam). Sistem genelinde VKN tekilliği kontrol düzlemindedir (07 §2.2).

create schema if not exists portfolio;
grant usage on schema portfolio to authenticated;

create table portfolio.firms (
  org_id uuid not null references organization.organizations(id),
  id uuid not null,
  advisor_id uuid not null,
  title text not null check (length(title) between 1 and 300),
  kind text not null check (kind in ('Limited', 'Anonim', 'Şahıs', 'Esnaf', 'Serbest Meslek', 'Belirtilmedi')),
  tax_id text not null check (tax_id ~ '^[0-9]{10,11}$'),
  tax_id_kind text not null check (tax_id_kind in ('VKN', 'TCKN')),
  tax_office text check (length(tax_office) <= 120),
  city text check (length(city) <= 80),
  representative text check (length(representative) <= 160),
  phone text check (length(phone) <= 40),
  email text check (length(email) <= 160),
  activity_code text check (length(activity_code) <= 20),
  activity_name text check (length(activity_name) <= 300),
  tax_regime text not null default 'Belirtilmedi' check (tax_regime in ('Belirtilmedi', 'Gerçek Usul', 'Basit Usul')),
  status text not null default 'Onay Bekliyor' check (status in ('Onay Bekliyor', 'Aktif', 'Pasif')),
  group_name text check (length(group_name) <= 120),
  source text not null default 'manual' check (source in ('manual', 'gib_contract')),
  archived_at timestamptz,
  version int not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (org_id, id),
  foreign key (org_id, advisor_id) references organization.advisors(org_id, id)
);
-- Ofis içinde de aktif VKN tekil (sistem genelindeki tekillik kontrol düzleminde)
create unique index firms_tax_id_aktif on portfolio.firms(org_id, tax_id) where archived_at is null;
create index firms_advisor on portfolio.firms(org_id, advisor_id);

create table portfolio.staff_assignments (
  org_id uuid not null,
  user_id uuid not null,
  firm_id uuid not null,
  assigned_by uuid not null,
  primary key (org_id, user_id, firm_id),
  foreign key (org_id, firm_id) references portfolio.firms(org_id, id) on delete cascade
);

create table portfolio.firm_users (
  org_id uuid not null,
  firm_id uuid not null,
  user_id uuid not null,
  can_edit_credentials boolean not null default true,
  primary key (org_id, firm_id, user_id),
  foreign key (org_id, firm_id) references portfolio.firms(org_id, id) on delete cascade
);

create or replace function app.can_see_firm(p_org uuid, p_firm uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select app.is_system(p_org) or (app.is_member(p_org) and case app.role_in(p_org)
    when 'ofis_admin' then exists (select 1 from portfolio.firms f where f.org_id = p_org and f.id = p_firm)
    when 'musavir' then exists (select 1 from portfolio.firms f join organization.advisors a on a.org_id = f.org_id and a.id = f.advisor_id
                                 where f.org_id = p_org and f.id = p_firm and a.user_id = app.uid())
    when 'personel' then exists (select 1 from portfolio.staff_assignments s where s.org_id = p_org and s.firm_id = p_firm and s.user_id = app.uid())
    when 'mukellef' then exists (select 1 from portfolio.firm_users u where u.org_id = p_org and u.firm_id = p_firm and u.user_id = app.uid())
    else false end)
$$;

-- Kullanıcının müşavir kaydı (yeni firmanın varsayılan müşaviri)
create or replace function app.my_advisor(p_org uuid) returns uuid
language sql stable security definer set search_path = '' as $$
  select a.id from organization.advisors a where a.org_id = p_org and a.user_id = app.uid() and app.is_member(p_org)
$$;

revoke all on function app.can_see_firm(uuid, uuid), app.my_advisor(uuid) from public;
grant execute on function app.can_see_firm(uuid, uuid), app.my_advisor(uuid) to authenticated;

alter table portfolio.firms enable row level security;
alter table portfolio.staff_assignments enable row level security;
alter table portfolio.firm_users enable row level security;

create policy oku on portfolio.firms for select to authenticated using (app.can_see_firm(org_id, id));
-- Ekleme: ofis yöneticisi herhangi bir müşavir adına, müşavir yalnız kendi adına; sistem (GİB aktarımı) da ekleyebilir
create policy ekle on portfolio.firms for insert to authenticated with check (
  app.is_system(org_id) or app.role_in(org_id) = 'ofis_admin' or (app.role_in(org_id) = 'musavir' and advisor_id = app.my_advisor(org_id)));
create policy guncelle on portfolio.firms for update to authenticated
  using (app.is_system(org_id) or (app.can_see_firm(org_id, id) and app.role_in(org_id) in ('ofis_admin', 'musavir')))
  with check (app.is_system(org_id) or app.role_in(org_id) = 'ofis_admin' or (app.role_in(org_id) = 'musavir' and advisor_id = app.my_advisor(org_id)));

create policy oku on portfolio.staff_assignments for select to authenticated using (app.is_member(org_id) or app.is_system(org_id));
create policy oku on portfolio.firm_users for select to authenticated using (app.can_see_firm(org_id, firm_id));

grant select, insert, update on portfolio.firms to authenticated;
grant select on portfolio.staff_assignments, portfolio.firm_users to authenticated;
