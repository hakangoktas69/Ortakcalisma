-- tax_filing: e-Beyanname kayıtları (Declaration, 06 §2). GİB e-Beyanname listesinden, aynı oturumdaki "Aracılık ve
-- Sorumluluk" sözleşmesi kanıtıyla gelir (eski kurum incelemesi kuralı). Kaynak satır kimliği firmada tekildir;
-- yeniden görülen kayıt güncellenir, kaynaktan kalkan kayıt silinmez.

create table tax_filing.declarations (
  org_id uuid not null,
  id uuid not null default gen_random_uuid(),
  firm_id uuid not null,
  source_record_id text not null check (source_record_id ~ '^([A-Za-z0-9_-]{1,100}|encoded-[0-9a-f]{64})$'),
  declaration_type text not null check (declaration_type ~ '^[A-Z0-9_-]{1,30}$'),
  period_start date not null check (extract(day from period_start) = 1),
  period_end date not null check (extract(day from period_end) = 1 and period_end >= period_start),
  uploaded_at timestamptz not null,
  tax_status text not null check (length(tax_status) between 1 and 200),
  sgk_status text not null default '' check (length(sgk_status) <= 200),
  branch text not null default '' check (length(branch) <= 20),
  reference text not null check (length(reference) between 1 and 200),
  reference_type text not null check (reference_type in ('source_filename', 'source_record_id')),
  contract_numbers text[] not null check (cardinality(contract_numbers) between 1 and 20),
  source text not null check (source in ('gib_live', 'sahte_gib')),
  last_seen_job uuid not null,
  last_seen_at timestamptz not null default now(),
  primary key (org_id, id),
  unique (org_id, firm_id, source_record_id),
  foreign key (org_id, firm_id) references portfolio.firms(org_id, id)
);
create index declarations_donem on tax_filing.declarations(org_id, period_start desc, firm_id);

alter table tax_filing.declarations enable row level security;
create policy oku on tax_filing.declarations for select to authenticated using (app.can_see_firm(org_id, firm_id) or app.is_system(org_id));
create policy yaz on tax_filing.declarations for insert to authenticated with check (app.is_system(org_id));
create policy guncelle on tax_filing.declarations for update to authenticated using (app.is_system(org_id)) with check (app.is_system(org_id));
grant select, insert, update on tax_filing.declarations to authenticated;

-- İşçi sözleşmeleri de sistem bağlamında okur (erişim kanıtı ve eşleme)
drop policy oku on tax_filing.filing_contracts;
create policy oku on tax_filing.filing_contracts for select to authenticated using (app.can_see_firm(org_id, firm_id) or app.is_system(org_id));
