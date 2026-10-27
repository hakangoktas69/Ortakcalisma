-- notices: e-Tebligat (D45). Bugün GİB Dijital VD e-Tebligat listesi; ileride UETS. Yalnız liste bilgisi saklanır (belge açılmaz,
-- belge içeriği yok). Kurum kayıt kimliği açık tutulmaz: ACL'nin ürettiği SHA-256 (notice_key). Firma kapsamında okunur (ofis
-- personeli ve mükellef kendi firması); yalnız işçi (sistem bağlamı) yazar. Yeni şema: mevcut veriye etkisi yok.
-- Ayrıca sync: firma hesabıyla e-Tebligat işi (gib.etebligat).

create schema if not exists notices;
grant usage on schema notices to authenticated;

create table if not exists notices.notices (
  org_id uuid not null references organization.organizations(id),
  id uuid not null default gen_random_uuid(),
  firm_id uuid not null,
  notice_key text not null check (notice_key ~ '^[a-f0-9]{64}$'),
  reference text not null check (length(reference) between 1 and 2000),
  document_type text not null check (length(document_type) between 1 and 2000),
  sender text not null check (length(sender) between 1 and 2000),
  department text not null default '' check (length(department) <= 2000),
  sent_on date not null,
  delivered_on date,
  read_on date,
  job_id uuid not null,
  first_seen_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (org_id, id),
  unique (org_id, firm_id, notice_key),
  foreign key (org_id, firm_id) references portfolio.firms(org_id, id)
);
create index if not exists notices_firma_tarih on notices.notices(org_id, firm_id, sent_on desc);

alter table notices.notices enable row level security;
drop policy if exists oku on notices.notices;
create policy oku on notices.notices for select to authenticated using (app.is_system(org_id) or app.can_see_firm(org_id, firm_id));
drop policy if exists sistem_yazar on notices.notices;
create policy sistem_yazar on notices.notices for all to authenticated using (app.is_system(org_id)) with check (app.is_system(org_id));
grant select, insert, update on notices.notices to authenticated;

alter table sync.jobs drop constraint if exists jobs_kind_check;
alter table sync.jobs add constraint jobs_kind_check check (kind in ('gib.sozlesmeler', 'gib.beyannameler', 'gib.muhsgk', 'takvim.kaynaklar', 'gib.etebligat'));
