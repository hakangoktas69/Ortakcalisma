-- @F:satis.ofis.create
-- Satış portalının kontrol düzlemi (D27, D40): eworks_sales rolünün sınırı, satış hesabı kısıtları, satış denetim zinciri.
select plan(13);

select has_role('eworks_sales', 'satış giriş rolü var');
select is((select rolbypassrls from pg_roles where rolname = 'eworks_sales'), false, 'satış rolü BYPASSRLS değil');
select ok(has_table_privilege('eworks_sales', 'sales.users', 'select,insert,update'), 'satış kullanıcılarını okur/yazar');
select ok(not has_table_privilege('eworks_sales', 'sales.users', 'delete'), 'satış kullanıcısı silinmez (kapatılır)');
select ok(not has_table_privilege('eworks_sales', 'sales.audit_entries', 'insert') and not has_table_privilege('eworks_sales', 'sales.audit_entries', 'update')
  and not has_table_privilege('eworks_sales', 'sales.audit_entries', 'delete'), 'satış denetim kaydı yalnız sales.record ile yazılır, değiştirilemez');
select ok(not has_table_privilege('eworks_sales', 'directory.taxpayer_registry', 'select'), 'satış VKN dizinini göremez');
select ok(not has_table_privilege('eworks_sales', 'directory.organizations', 'update') and not has_table_privilege('eworks_sales', 'directory.organizations', 'delete'),
  'satış bu aşamada ofisi değiştiremez/silemez (dondurma ayrı iş)');

insert into directory.organizations(id, name, shard_id) values ('aaaaaaaa-0000-0000-0000-00000000000a', 'Satış Testi Ofisi', 'shard-01');
select throws_ok($$insert into sales.accounts(org_id, contact_name, contact_email, contact_phone, plan) values ('aaaaaaaa-0000-0000-0000-00000000000a', 'A', 'a@b.test', '905321234567', 'bedava')$$,
  '23514', null, 'bilinmeyen paket reddedilir');
select throws_ok($$insert into sales.users(id, email, full_name, password_hash) values (gen_random_uuid(), 'Buyuk@Harf.test', 'X', 'h')$$,
  '23514', null, 'e-posta küçük harfle saklanır');
select throws_ok($$insert into sales.users(id, email, full_name, password_hash, totp_enabled_at) values (gen_random_uuid(), 'x@y.test', 'X', 'h', now())$$,
  '23514', null, '2FA açık kullanıcının gizli anahtarı olmalı');

select sales.record(null, 'satis.test.bir', 'x', '{}'::jsonb);
select sales.record(null, 'satis.test.iki', 'y', '{"paket":"pro"}'::jsonb);
select is((select prev_hash from sales.audit_entries where action = 'satis.test.iki'), (select hash from sales.audit_entries where action = 'satis.test.bir'),
  'her kayıt öncekinin özetini taşır (hash zinciri)');
select throws_ok($$select sales.record(null, 'Gecersiz Eylem', null, '{}'::jsonb)$$, '23514', null, 'eylem adı biçime uyar');
select ok(not has_schema_privilege('eworks_control', 'sales', 'usage') and not has_function_privilege('eworks_control', 'sales.record(uuid, text, text, jsonb)', 'execute'),
  'portal (eworks_control) satış şemasına erişemez, satış denetimine yazamaz');

select * from finish();
