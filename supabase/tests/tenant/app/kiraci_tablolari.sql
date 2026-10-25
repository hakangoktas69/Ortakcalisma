-- Kiracı tabloları genel kuralı (kurallar §1): her tabloda org_id, PK (org_id, …) ile başlar, RLS açık ve zorunlu politika var.
-- Kurum verisini yalnız işçi yazar: kullanıcı (authenticated) için ekleme politikası is_system ister (sync.jobs hariç: kullanıcı iş ister).
select plan(5);

create temporary view kiraci as
  select c.oid, n.nspname || '.' || c.relname as ad
    from pg_class c join pg_namespace n on n.oid = c.relnamespace
   where c.relkind = 'r' and n.nspname in ('sync', 'tax_filing', 'documents', 'social_security', 'portfolio', 'credentials', 'audit');

select ok((select count(*) from kiraci) >= 9, 'denetlenen kiracı tabloları bulundu');
select is(
  (select array_agg(ad order by ad) from kiraci k where not exists (select 1 from pg_attribute a where a.attrelid = k.oid and a.attname = 'org_id' and not a.attisdropped)),
  null, 'her kiracı tablosunda org_id var');
select is(
  (select array_agg(ad order by ad) from kiraci k join pg_constraint p on p.conrelid = k.oid and p.contype = 'p'
     where (select attname from pg_attribute where attrelid = k.oid and attnum = p.conkey[1]) <> 'org_id'),
  null, 'birincil anahtar org_id ile başlar');
select is((select array_agg(ad order by ad) from kiraci k join pg_class c on c.oid = k.oid where not c.relrowsecurity), null, 'her kiracı tablosunda RLS açık');
select is(
  (select array_agg(k.ad order by k.ad) from kiraci k join pg_policy p on p.polrelid = k.oid
     where p.polcmd = 'a' and k.ad in ('tax_filing.declarations', 'tax_filing.filing_contracts', 'documents.files', 'social_security.workplace_filings')
       and pg_get_expr(p.polwithcheck, p.polrelid) not like '%is_system%'),
  null, 'kurum verisi tablolarına yalnız sistem (işçi) ekler');

select * from finish();
