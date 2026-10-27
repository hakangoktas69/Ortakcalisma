-- workspace: mali müşavir takvimi (Mert 26.10 takvimi). Ortak takvim verisi (GİB vergi takvimi, resmî tatiller, mevzuat
-- kuralından hesaplanan tarihler, dönem sonları) her ofisin shard'ında kopyadır; yalnız işçi (sistem bağlamı) yazar. Ofis
-- personeli okur. Ofis yöneticisi bir tarihi düzeltebilir (denetim kaydıyla); düzeltme yeniden içe aktarmada korunur.
-- Kişisel veri yok (kayıtlar genel yükümlülük ve tatil bilgisidir). Yeni tablo: mevcut veriye etkisi yok.

create table if not exists workspace.calendar_entries (
  org_id uuid not null references organization.organizations(id),
  id text not null check (length(id) between 1 and 80),
  year int not null check (year between 2000 and 2100),
  entry_date date not null,
  title text not null check (length(title) between 1 and 500),
  description text not null check (length(description) <= 4000),
  category text not null check (category in ('beyan', 'odeme', 'bildirim', 'berat', 'personel', 'tatil', 'donem', 'diger')),
  source text not null check (source in ('gib', 'tatil', 'kural')),
  certainty text not null check (certainty in ('kesin', 'kesinlesmedi')),
  half_day boolean not null default false,
  period text check (length(period) <= 200),
  source_url text check (source_url ~ '^https://' and length(source_url) <= 500),
  checked_at date,
  reference text check (length(reference) <= 200),
  corrected_date date,
  corrected_by uuid,
  corrected_at timestamptz,
  updated_at timestamptz not null default now(),
  primary key (org_id, id)
);
create index if not exists calendar_entries_tarih on workspace.calendar_entries(org_id, coalesce(corrected_date, entry_date));
create index if not exists calendar_entries_yil on workspace.calendar_entries(org_id, year, source);

alter table workspace.calendar_entries enable row level security;
drop policy if exists oku on workspace.calendar_entries;
create policy oku on workspace.calendar_entries for select to authenticated using (app.is_system(org_id) or app.is_staff_of(org_id));
drop policy if exists sistem_yazar on workspace.calendar_entries;
create policy sistem_yazar on workspace.calendar_entries for all to authenticated using (app.is_system(org_id)) with check (app.is_system(org_id));
grant select, insert, update, delete on workspace.calendar_entries to authenticated;

/** Tarih düzeltme (p_date null: düzeltmeyi kaldır). Yalnız ofis yöneticisi; denetim kaydına eski/yeni tarih yazılır. */
create or replace function workspace.correct_calendar_entry(p_org uuid, p_id text, p_date date) returns boolean
language plpgsql security definer set search_path = '' as $$
declare v_eski date;
begin
  if not app.is_member(p_org) or app.role_in(p_org) <> 'ofis_admin' then
    raise exception 'Takvim düzeltme yetkisi yok' using errcode = '42501';
  end if;
  select coalesce(e.corrected_date, e.entry_date) into v_eski from workspace.calendar_entries e where e.org_id = p_org and e.id = p_id for update;
  if not found then return false; end if;
  update workspace.calendar_entries set corrected_date = p_date, corrected_by = case when p_date is null then null else app.uid() end,
         corrected_at = case when p_date is null then null else now() end
   where org_id = p_org and id = p_id;
  perform audit.record(p_org, 'takvim.tarih_duzeltildi', p_id, pg_catalog.jsonb_build_object('eski', v_eski, 'yeni', p_date));
  return true;
end $$;
revoke all on function workspace.correct_calendar_entry(uuid, text, date) from public;
grant execute on function workspace.correct_calendar_entry(uuid, text, date) to authenticated;
