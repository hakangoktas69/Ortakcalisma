-- workspace: görevler ve notlar (Task, Note, 06 §2). Eski portalın "Takvim ve Görevler" (başlık, mükellef, son tarih, sorumlu,
-- durum) ve firma notları. Mükellef kullanıcıları ofisin iç işlerini görmez. Firmaya bağlı kayıt firma kapsamındadır.

create schema if not exists workspace;
grant usage on schema workspace to authenticated;

create table workspace.tasks (
  org_id uuid not null,
  id uuid not null default gen_random_uuid(),
  title text not null check (length(title) between 1 and 120),
  firm_id uuid,
  due_on date not null,
  status text not null default 'Bekliyor' check (status in ('Bekliyor', 'Devam Ediyor', 'Öncelikli', 'Tamamlandı')),
  assignee_id uuid,
  created_by uuid not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  closed_at timestamptz,
  version int not null default 1,
  primary key (org_id, id),
  foreign key (org_id, firm_id) references portfolio.firms(org_id, id),
  foreign key (org_id, assignee_id) references identity_access.memberships(org_id, user_id),
  foreign key (org_id, created_by) references identity_access.memberships(org_id, user_id)
);
create index tasks_acik on workspace.tasks(org_id, due_on) where status <> 'Tamamlandı';

create table workspace.notes (
  org_id uuid not null,
  id uuid not null default gen_random_uuid(),
  firm_id uuid not null,
  body text not null check (length(body) between 1 and 2000),
  author_id uuid not null,
  created_at timestamptz not null default now(),
  primary key (org_id, id),
  foreign key (org_id, firm_id) references portfolio.firms(org_id, id),
  foreign key (org_id, author_id) references identity_access.memberships(org_id, user_id)
);
create index notes_firma on workspace.notes(org_id, firm_id, created_at desc);

-- Ofis içi kullanıcı (mükellef değil) ve firma kapsamı
create or replace function app.is_staff_of(p_org uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select app.is_member(p_org) and app.role_in(p_org) in ('ofis_admin', 'musavir', 'personel')
$$;
revoke all on function app.is_staff_of(uuid) from public;
grant execute on function app.is_staff_of(uuid) to authenticated;

alter table workspace.tasks enable row level security;
alter table workspace.notes enable row level security;

create policy oku on workspace.tasks for select to authenticated
  using (app.is_staff_of(org_id) and (firm_id is null or app.can_see_firm(org_id, firm_id)));
create policy ekle on workspace.tasks for insert to authenticated
  with check (app.is_staff_of(org_id) and created_by = app.uid() and (firm_id is null or app.can_see_firm(org_id, firm_id)));
-- Güncelleme: yönetici/müşavir ya da görevin sorumlusu/oluşturanı
create policy guncelle on workspace.tasks for update to authenticated
  using (app.is_staff_of(org_id) and (firm_id is null or app.can_see_firm(org_id, firm_id))
         and (app.role_in(org_id) in ('ofis_admin', 'musavir') or assignee_id = app.uid() or created_by = app.uid()))
  with check (app.is_staff_of(org_id) and (firm_id is null or app.can_see_firm(org_id, firm_id)));
grant select, insert, update (status, assignee_id, updated_at, closed_at, version) on workspace.tasks to authenticated;

-- Notlar eklenir, değiştirilmez/silinmez (kimin ne yazdığı kalır)
create policy oku on workspace.notes for select to authenticated using (app.is_staff_of(org_id) and app.can_see_firm(org_id, firm_id));
create policy ekle on workspace.notes for insert to authenticated
  with check (app.is_staff_of(org_id) and author_id = app.uid() and app.can_see_firm(org_id, firm_id));
grant select, insert on workspace.notes to authenticated;
