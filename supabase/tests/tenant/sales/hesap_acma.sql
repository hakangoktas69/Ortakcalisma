-- @F:satis.ofis.create
-- Shard'da hesap açma (D27): eworks_sales mükellef iş verisini göremez, yalnız hesap açma fonksiyonlarını çağırır;
-- her işlem ofisin denetim kaydına zincirli yazılır. Gerçek oturum rolüyle davranış: sales/test/infrastructure/satis.int.test.ts
select plan(14);

select has_role('eworks_sales', 'satış giriş rolü var');
select ok(not pg_has_role('eworks_sales', 'authenticated', 'member'), 'satış rolü authenticated üyesi değil: RLS tablolarına giremez');
select is((select rolbypassrls from pg_roles where rolname = 'eworks_sales'), false, 'satış rolü BYPASSRLS değil');
select is((select count(*)::int from information_schema.role_table_grants where grantee = 'eworks_sales'), 0, 'satış rolünün hiçbir tabloda yetkisi yok');
select ok(not has_table_privilege('eworks_sales', 'tax_filing.declarations', 'select'), 'beyannameleri göremez');
select ok(not has_table_privilege('eworks_sales', 'documents.files', 'select'), 'belgeleri göremez');
select ok(has_function_privilege('eworks_sales', 'sales.add_member(uuid, uuid, text, text, uuid, uuid)', 'execute'), 'hesap açma fonksiyonunu çağırır');
select ok(not has_function_privilege('eworks_sales', 'audit.append(uuid, uuid, text, text, text, jsonb)', 'execute')
  and not has_function_privilege('authenticated', 'audit.append(uuid, uuid, text, text, text, jsonb)', 'execute'), 'denetim kaydına doğrudan yazılamaz');
select ok(not has_function_privilege('eworks_app', 'sales.add_member(uuid, uuid, text, text, uuid, uuid)', 'execute'), 'web rolü hesap açamaz');

select sales.open_organization('cccccccc-0000-0000-0000-00000000000c', 'Hesap Açma Testi', 'dddddddd-0000-0000-0000-00000000000d');
select sales.open_organization('cccccccc-0000-0000-0000-00000000000c', 'Hesap Açma Testi', null);
select sales.add_member('cccccccc-0000-0000-0000-00000000000c', '11111111-0000-0000-0000-0000000000c1', 'ofis_admin', 'Yönetici', 'eeeeeeee-0000-0000-0000-00000000000e', 'dddddddd-0000-0000-0000-00000000000d');

select is((select array_agg(action order by id) from audit.entries where org_id = 'cccccccc-0000-0000-0000-00000000000c'), array['hesap.ofis_acildi', 'hesap.uye_eklendi'],
  'ofis açılışı ve üye ekleme ofisin denetim kaydında; tekrar açma yeni kayıt üretmez');
select is((select details->>'satis_kullanici' from audit.entries where org_id = 'cccccccc-0000-0000-0000-00000000000c' and action = 'hesap.uye_eklendi'),
  'dddddddd-0000-0000-0000-00000000000d', 'işlemi yapan satış kullanıcısı kayıtta');
select is((select prev_hash from audit.entries where org_id = 'cccccccc-0000-0000-0000-00000000000c' and action = 'hesap.uye_eklendi'),
  (select hash from audit.entries where org_id = 'cccccccc-0000-0000-0000-00000000000c' and action = 'hesap.ofis_acildi'), 'zincir sürer');
select ok(sales.is_member('cccccccc-0000-0000-0000-00000000000c', '11111111-0000-0000-0000-0000000000c1')
  and exists (select 1 from organization.advisors where org_id = 'cccccccc-0000-0000-0000-00000000000c' and user_id = '11111111-0000-0000-0000-0000000000c1'),
  'yönetici üye ve müşavir kaydı açıldı');
select throws_ok($$select sales.add_member('cccccccc-0000-0000-0000-00000000000c', gen_random_uuid(), 'patron', 'X', null, null)$$, '23514', null, 'bilinmeyen rol reddedilir');

select * from finish();
