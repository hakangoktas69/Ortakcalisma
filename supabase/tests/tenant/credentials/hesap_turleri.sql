-- @F:firmalar.kurum_hesaplari.edit_credentials
-- Kurum hesabı türleri: SGK işyeri başına (etiketli), UETS; bütün alanlar Vault'ta, tabloda yalnız etiket ve durum.
-- Yetki: kapsam dışı firma 42501; müşavirin SGK/UETS hesabı, eksik/fazla alan, bilinmeyen kurum 22023.
select plan(14);

insert into organization.organizations(id, name) values ('aaaaaaaa-0000-0000-0000-00000000000c', 'C');
insert into organization.advisors(org_id, id, user_id, title) values
  ('aaaaaaaa-0000-0000-0000-00000000000c', 'adadadad-0000-0000-0000-000000000011', '11111111-0000-0000-0000-000000000011', 'M1'),
  ('aaaaaaaa-0000-0000-0000-00000000000c', 'adadadad-0000-0000-0000-000000000012', '22222222-0000-0000-0000-000000000012', 'M2');
insert into identity_access.memberships(org_id, user_id, role, display_name) values
  ('aaaaaaaa-0000-0000-0000-00000000000c', '11111111-0000-0000-0000-000000000011', 'musavir', 'M1'),
  ('aaaaaaaa-0000-0000-0000-00000000000c', '22222222-0000-0000-0000-000000000012', 'musavir', 'M2');
insert into portfolio.firms(org_id, id, advisor_id, title, kind, tax_id, tax_id_kind) values
  ('aaaaaaaa-0000-0000-0000-00000000000c', 'f1f1f1f1-0000-0000-0000-000000000011', 'adadadad-0000-0000-0000-000000000011', 'M1 Ltd', 'Limited', '1234567801', 'VKN');

select ok(has_column_privilege('authenticated', 'credentials.institution_accounts', 'label', 'SELECT'), 'işyeri adı (etiket) web rolüne görünür');

set local role authenticated;
select set_config('request.jwt.claims', '{"role":"authenticated","sub":"11111111-0000-0000-0000-000000000011","org":"aaaaaaaa-0000-0000-0000-00000000000c"}', true);

select lives_ok($$select credentials.save_account_secret('aaaaaaaa-0000-0000-0000-00000000000c', 'firm', 'f1f1f1f1-0000-0000-0000-000000000011', 'SGK', 'Merkez',
  '{"username":"u1","workplaceCode":"1","systemPassword":"s1","workplacePassword":"i1"}')$$, 'SGK işyeri hesabı kaydedilir');
select lives_ok($$select credentials.save_account_secret('aaaaaaaa-0000-0000-0000-00000000000c', 'firm', 'f1f1f1f1-0000-0000-0000-000000000011', 'SGK', 'Şube',
  '{"username":"u2","workplaceCode":"2","systemPassword":"s2","workplacePassword":"i2"}')$$, 'aynı firmanın ikinci işyeri ayrı hesap');
select lives_ok($$select credentials.save_account_secret('aaaaaaaa-0000-0000-0000-00000000000c', 'firm', 'f1f1f1f1-0000-0000-0000-000000000011', 'SGK', 'Merkez',
  '{"username":"u1","workplaceCode":"1","systemPassword":"s1-yeni","workplacePassword":"i1"}')$$, 'aynı işyeri adı güncellenir');
select is((select string_agg(label, ',' order by label) from credentials.institution_accounts where owner_id = 'f1f1f1f1-0000-0000-0000-000000000011' and institution = 'SGK'),
  'Merkez,Şube', 'firmanın iki SGK işyeri hesabı var');
select lives_ok($$select credentials.save_account_secret('aaaaaaaa-0000-0000-0000-00000000000c', 'firm', 'f1f1f1f1-0000-0000-0000-000000000011', 'UETS', '',
  '{"address":"a","password":"p"}')$$, 'UETS hesabı kaydedilir');
select lives_ok($$select credentials.save_account('aaaaaaaa-0000-0000-0000-00000000000c', 'firm', 'f1f1f1f1-0000-0000-0000-000000000011', 'GIB', 'k', 'p')$$,
  'eski GİB kaydı yolu çalışmaya devam eder');

select throws_ok($$select credentials.save_account_secret('aaaaaaaa-0000-0000-0000-00000000000c', 'advisor', 'adadadad-0000-0000-0000-000000000011', 'SGK', 'Merkez',
  '{"username":"u","workplaceCode":"1","systemPassword":"s","workplacePassword":"i"}')$$, '22023', null, 'müşavirin SGK hesabı olmaz');
select throws_ok($$select credentials.save_account_secret('aaaaaaaa-0000-0000-0000-00000000000c', 'firm', 'f1f1f1f1-0000-0000-0000-000000000011', 'SGK', '',
  '{"username":"u","workplaceCode":"1","systemPassword":"s","workplacePassword":"i"}')$$, '22023', null, 'SGK hesabı işyeri adı ister');
select throws_ok($$select credentials.save_account_secret('aaaaaaaa-0000-0000-0000-00000000000c', 'firm', 'f1f1f1f1-0000-0000-0000-000000000011', 'SGK', 'X',
  '{"username":"u","workplaceCode":"1","systemPassword":"s"}')$$, '22023', null, 'eksik alan reddedilir');
select throws_ok($$select credentials.save_account_secret('aaaaaaaa-0000-0000-0000-00000000000c', 'firm', 'f1f1f1f1-0000-0000-0000-000000000011', 'GIB', '',
  '{"username":"u","password":"p","not":"x"}')$$, '22023', null, 'fazladan alan reddedilir');
select throws_ok($$select credentials.save_account_secret('aaaaaaaa-0000-0000-0000-00000000000c', 'firm', 'f1f1f1f1-0000-0000-0000-000000000011', 'EDEVLET', '',
  '{"username":"u","password":"p"}')$$, '22023', null, 'e-Devlet şifresi saklanmaz');

select set_config('request.jwt.claims', '{"role":"authenticated","sub":"22222222-0000-0000-0000-000000000012","org":"aaaaaaaa-0000-0000-0000-00000000000c"}', true);
select throws_ok($$select credentials.save_account_secret('aaaaaaaa-0000-0000-0000-00000000000c', 'firm', 'f1f1f1f1-0000-0000-0000-000000000011', 'SGK', 'Merkez',
  '{"username":"u","workplaceCode":"1","systemPassword":"s","workplacePassword":"i"}')$$, '42501', null, 'kapsam dışı firmanın SGK hesabı girilemez');

reset role;
select is((select s.decrypted_secret::jsonb ->> 'systemPassword' from credentials.institution_accounts a join vault.decrypted_secrets s on s.id = a.secret_id
  where a.owner_id = 'f1f1f1f1-0000-0000-0000-000000000011' and a.institution = 'SGK' and a.label = 'Merkez'), 's1-yeni', 'alanlar Vault sırrında, son değerle');

select * from finish();
