-- documents: kurumdan alınan PDF'lerin metaverisi (Document, 06 §2). Dosya S3'te içerik özetiyle adreslenir
-- (org/<ofis>/belgeler/<sha256>.pdf). Saklama süresi dolunca dosya silinir, satır kalır (file_deleted_at, D15 / 02 §9):
-- portal "belge alındı, dosyası süre dolduğu için silindi" gösterir. Yeniden görülen belge dosyayı yeniden saklar.

create schema if not exists documents;
grant usage on schema documents to authenticated;

create table documents.files (
  org_id uuid not null,
  id uuid not null default gen_random_uuid(),
  firm_id uuid not null,
  subject_kind text not null check (subject_kind in ('declaration')),
  subject_id uuid not null,
  kind text not null check (kind in ('declaration', 'tax_accrual', 'sgk_accrual', 'sgk_service')),
  sha256 text not null check (sha256 ~ '^[0-9a-f]{64}$'),
  size int not null check (size between 100 and 20971520),
  storage_key text not null,
  source text not null check (source in ('gib_live', 'sahte_gib')),
  created_by_job uuid not null,
  created_at timestamptz not null default now(),
  stored_at timestamptz not null default now(),
  file_deleted_at timestamptz,
  primary key (org_id, id),
  unique (org_id, subject_id, kind, sha256),
  check (storage_key = 'org/' || org_id || '/belgeler/' || sha256 || '.pdf'),
  foreign key (org_id, firm_id) references portfolio.firms(org_id, id)
);
create index files_konu on documents.files(org_id, subject_id);
create index files_saklama on documents.files(org_id, stored_at) where file_deleted_at is null;

alter table documents.files enable row level security;
create policy oku on documents.files for select to authenticated using (app.can_see_firm(org_id, firm_id) or app.is_system(org_id));
create policy yaz on documents.files for insert to authenticated with check (app.is_system(org_id));
create policy guncelle on documents.files for update to authenticated using (app.is_system(org_id)) with check (app.is_system(org_id));
grant select, insert, update on documents.files to authenticated;
