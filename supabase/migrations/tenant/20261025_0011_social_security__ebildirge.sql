-- social_security: MUHSGK'dan gelen SGK bildirimleri (EBildirgeDocument, 06 §2): işyeri × ay, durum, tekil çalışan sayısı.
-- Kaynak: GİB e-Beyanname içindeki "SGK Bildirimleri" (eski robotun muhsgk_sgk_reader'ı). Çalışan kimliği ve adı
-- saklanmaz (KVKK); yalnız hizmet listesinden sayılan kişi sayısı. Yeniden görülen bildirim güncellenir, silinmez.

-- sync: SGK e-Bildirge toplu güncelleme işi (MUHSGK + SGK belgeleri)
alter table sync.jobs drop constraint jobs_kind_check;
alter table sync.jobs add constraint jobs_kind_check check (kind in ('gib.sozlesmeler', 'gib.beyannameler', 'gib.muhsgk'));

create schema if not exists social_security;
grant usage on schema social_security to authenticated;

create table social_security.workplace_filings (
  org_id uuid not null,
  id uuid not null default gen_random_uuid(),
  firm_id uuid not null,
  declaration_id uuid not null,
  source_record_id text not null check (source_record_id ~ '^([A-Za-z0-9_-]{1,100}|encoded-[0-9a-f]{64})$'),
  workplace text not null check (workplace ~ '^[0-9]{17,30}$'),
  period date not null check (extract(day from period) = 1),
  status text not null check (length(status) between 1 and 200),
  employee_count int check (employee_count between 0 and 100000),
  source text not null check (source in ('gib_live', 'sahte_gib')),
  last_seen_job uuid not null,
  last_seen_at timestamptz not null default now(),
  primary key (org_id, id),
  unique (org_id, firm_id, source_record_id),
  foreign key (org_id, firm_id) references portfolio.firms(org_id, id),
  foreign key (org_id, declaration_id) references tax_filing.declarations(org_id, id)
);
create index workplace_filings_donem on social_security.workplace_filings(org_id, period desc, firm_id);

alter table social_security.workplace_filings enable row level security;
create policy oku on social_security.workplace_filings for select to authenticated using (app.can_see_firm(org_id, firm_id) or app.is_system(org_id));
create policy yaz on social_security.workplace_filings for insert to authenticated with check (app.is_system(org_id));
create policy guncelle on social_security.workplace_filings for update to authenticated using (app.is_system(org_id)) with check (app.is_system(org_id));
grant select, insert, update on social_security.workplace_filings to authenticated;

-- documents: SGK tahakkuk ve hizmet listesi PDF'lerinin konusu SGK bildirimidir
alter table documents.files drop constraint files_subject_kind_check;
alter table documents.files add constraint files_subject_kind_check check (subject_kind in ('declaration', 'sgk_filing'));
