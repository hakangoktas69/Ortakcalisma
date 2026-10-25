-- tax_filing: e-Beyanname sözleşmeleri (FilingContract, 06 §2). GİB "Geçerli E-Beyanname Sözleşmeleri Listesi"nden gelir.
-- Kaynaktan kaybolan sözleşme silinmez (eski portal davranışı); son görüldüğü iş ve zaman tutulur.

create schema if not exists tax_filing;
grant usage on schema tax_filing to authenticated;

create table tax_filing.filing_contracts (
  org_id uuid not null,
  id uuid not null default gen_random_uuid(),
  firm_id uuid not null,
  number text not null check (length(number) between 1 and 100),
  contract_date text check (length(contract_date) <= 40),
  service text check (length(service) <= 200),
  registered_at text check (length(registered_at) <= 40),
  contract_type text check (length(contract_type) <= 200),
  tax_office text check (length(tax_office) <= 120),
  source text not null check (source in ('gib_live', 'sahte_gib')),
  last_seen_job uuid not null,
  last_seen_at timestamptz not null default now(),
  primary key (org_id, id),
  unique (org_id, firm_id, number),
  foreign key (org_id, firm_id) references portfolio.firms(org_id, id)
);

alter table tax_filing.filing_contracts enable row level security;
create policy oku on tax_filing.filing_contracts for select to authenticated using (app.can_see_firm(org_id, firm_id));
create policy yaz on tax_filing.filing_contracts for insert to authenticated with check (app.is_system(org_id));
create policy guncelle on tax_filing.filing_contracts for update to authenticated using (app.is_system(org_id)) with check (app.is_system(org_id));
grant select, insert, update on tax_filing.filing_contracts to authenticated;
