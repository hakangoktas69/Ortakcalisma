-- Kontrol düzlemi dizini: VKN tekilliği ve shard bütünlüğü (07 §2.2).
select plan(4);

select has_table('directory', 'taxpayer_registry', 'VKN dizini var');
select col_is_pk('directory', 'taxpayer_registry', 'tax_id_hash', 'VKN özeti sistem genelinde tekil');
select ok(exists (select 1 from directory.shards where id = 'shard-01'), 'migrate shard dizinini ortamdan eşitledi');
select throws_ok($$insert into directory.organizations(id, name, shard_id) values (gen_random_uuid(), 'x', 'shard-99')$$, '23503', null, 'tanımsız shard''a ofis atanamaz');

select * from finish();
