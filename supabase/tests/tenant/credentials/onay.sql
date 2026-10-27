-- @F:firmalar.kurum_hesaplari.consent
-- Mükellef onayı (D18, D46): yönetici/müşavir beyanla kaydeder, kapsam dışı firma 42501, gelecek tarih 22023; firma başına tek
-- etkin onay; geri alınabilir; her işlem denetim kaydında. Firma hesabının sırrı onay yoksa işe verilmez (EW001).
select plan(11);

insert into organization.organizations(id, name) values ('aaaaaaaa-0000-0000-0000-000000000011', 'O');
insert into organization.advisors(org_id, id, user_id, title) values
  ('aaaaaaaa-0000-0000-0000-000000000011', 'adadadad-0000-0000-0000-000000000051', '11111111-0000-0000-0000-000000000051', 'M1'),
  ('aaaaaaaa-0000-0000-0000-000000000011', 'adadadad-0000-0000-0000-000000000052', '22222222-0000-0000-0000-000000000052', 'M2');
insert into identity_access.memberships(org_id, user_id, role, display_name) values
  ('aaaaaaaa-0000-0000-0000-000000000011', '11111111-0000-0000-0000-000000000051', 'musavir', 'M1'),
  ('aaaaaaaa-0000-0000-0000-000000000011', '22222222-0000-0000-0000-000000000052', 'musavir', 'M2');
insert into portfolio.firms(org_id, id, advisor_id, title, kind, tax_id, tax_id_kind) values
  ('aaaaaaaa-0000-0000-0000-000000000011', 'f1f1f1f1-0000-0000-0000-000000000051', 'adadadad-0000-0000-0000-000000000051', 'M1 Ltd', 'Limited', '1234567803', 'VKN');

select ok((select relrowsecurity from pg_class where oid = 'credentials.consents'::regclass), 'RLS açık');

set local role authenticated;
select set_config('request.jwt.claims', '{"role":"authenticated","sub":"11111111-0000-0000-0000-000000000051","org":"aaaaaaaa-0000-0000-0000-000000000011"}', true);
select throws_ok($$select credentials.record_consent('aaaaaaaa-0000-0000-0000-000000000011', 'f1f1f1f1-0000-0000-0000-000000000051', 'sozlesme', current_date + 1)$$,
  '22023', null, 'gelecek tarihli onay kaydedilmez');
select lives_ok($$select credentials.record_consent('aaaaaaaa-0000-0000-0000-000000000011', 'f1f1f1f1-0000-0000-0000-000000000051', 'sozlesme', current_date)$$, 'müşavir onayı kaydeder');
select lives_ok($$select credentials.record_consent('aaaaaaaa-0000-0000-0000-000000000011', 'f1f1f1f1-0000-0000-0000-000000000051', 'eposta', current_date)$$, 'ikinci kayıt etkin onayı değiştirmez');
select is((select count(*)::int from credentials.consents where firm_id = 'f1f1f1f1-0000-0000-0000-000000000051' and revoked_at is null), 1, 'firma başına tek etkin onay');
select is(credentials.has_consent('aaaaaaaa-0000-0000-0000-000000000011', 'f1f1f1f1-0000-0000-0000-000000000051'), true, 'onay var');
select throws_ok($$insert into credentials.consents(org_id, firm_id, method, consented_on, recorded_by)
  values ('aaaaaaaa-0000-0000-0000-000000000011', 'f1f1f1f1-0000-0000-0000-000000000051', 'diger', current_date, '11111111-0000-0000-0000-000000000051')$$, '42501', null, 'tabloya doğrudan yazılamaz');

select set_config('request.jwt.claims', '{"role":"authenticated","sub":"22222222-0000-0000-0000-000000000052","org":"aaaaaaaa-0000-0000-0000-000000000011"}', true);
select throws_ok($$select credentials.revoke_consent('aaaaaaaa-0000-0000-0000-000000000011', 'f1f1f1f1-0000-0000-0000-000000000051')$$, '42501', null, 'kapsam dışı müşavir onayı geri alamaz');

select set_config('request.jwt.claims', '{"role":"authenticated","sub":"11111111-0000-0000-0000-000000000051","org":"aaaaaaaa-0000-0000-0000-000000000011"}', true);
select lives_ok($$select credentials.revoke_consent('aaaaaaaa-0000-0000-0000-000000000011', 'f1f1f1f1-0000-0000-0000-000000000051')$$, 'müşavir onayı geri alır');
select is(credentials.has_consent('aaaaaaaa-0000-0000-0000-000000000011', 'f1f1f1f1-0000-0000-0000-000000000051'), false, 'geri alınan onay geçersiz');
reset role;
select is((select string_agg(action, ',' order by id) from audit.entries where org_id = 'aaaaaaaa-0000-0000-0000-000000000011'),
  'mukellef_onayi.kaydedildi,mukellef_onayi.geri_alindi', 'kayıt ve geri alma denetim kaydında');

select * from finish();
