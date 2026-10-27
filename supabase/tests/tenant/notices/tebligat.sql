-- @F:tebligat.liste.view
-- e-Tebligat kayıtları (D45): firma kapsamında okunur (kapsam dışı müşavir ve başka ofis görmez), web rolü yazamaz (yalnız işçi).
select plan(5);

insert into organization.organizations(id, name) values ('aaaaaaaa-0000-0000-0000-000000000012', 'N'), ('aaaaaaaa-0000-0000-0000-000000000013', 'N2');
insert into organization.advisors(org_id, id, user_id, title) values
  ('aaaaaaaa-0000-0000-0000-000000000012', 'adadadad-0000-0000-0000-000000000061', '11111111-0000-0000-0000-000000000061', 'M1'),
  ('aaaaaaaa-0000-0000-0000-000000000012', 'adadadad-0000-0000-0000-000000000062', '22222222-0000-0000-0000-000000000062', 'M2');
insert into identity_access.memberships(org_id, user_id, role, display_name) values
  ('aaaaaaaa-0000-0000-0000-000000000012', '11111111-0000-0000-0000-000000000061', 'musavir', 'M1'),
  ('aaaaaaaa-0000-0000-0000-000000000012', '22222222-0000-0000-0000-000000000062', 'musavir', 'M2'),
  ('aaaaaaaa-0000-0000-0000-000000000013', '33333333-0000-0000-0000-000000000063', 'ofis_admin', 'B');
insert into portfolio.firms(org_id, id, advisor_id, title, kind, tax_id, tax_id_kind) values
  ('aaaaaaaa-0000-0000-0000-000000000012', 'f1f1f1f1-0000-0000-0000-000000000061', 'adadadad-0000-0000-0000-000000000061', 'M1 Ltd', 'Limited', '1234567804', 'VKN');
insert into notices.notices(org_id, firm_id, notice_key, reference, document_type, sender, department, sent_on, job_id) values
  ('aaaaaaaa-0000-0000-0000-000000000012', 'f1f1f1f1-0000-0000-0000-000000000061', repeat('a', 64), 'B-1', 'Ödeme Emri', 'VDB', '', '2026-10-20', gen_random_uuid());

select ok((select relrowsecurity from pg_class where oid = 'notices.notices'::regclass), 'RLS açık');
set local role authenticated;
select set_config('request.jwt.claims', '{"role":"authenticated","sub":"11111111-0000-0000-0000-000000000061","org":"aaaaaaaa-0000-0000-0000-000000000012"}', true);
select is((select count(*)::int from notices.notices), 1, 'firmanın müşaviri görür');
select throws_ok($$insert into notices.notices(org_id, firm_id, notice_key, reference, document_type, sender, department, sent_on, job_id)
  values ('aaaaaaaa-0000-0000-0000-000000000012', 'f1f1f1f1-0000-0000-0000-000000000061', repeat('b', 64), 'B-2', 'X', 'Y', '', '2026-10-20', gen_random_uuid())$$,
  '42501', null, 'web rolü tebligat yazamaz');
select set_config('request.jwt.claims', '{"role":"authenticated","sub":"22222222-0000-0000-0000-000000000062","org":"aaaaaaaa-0000-0000-0000-000000000012"}', true);
select is((select count(*)::int from notices.notices), 0, 'kapsam dışı müşavir görmez');
select set_config('request.jwt.claims', '{"role":"authenticated","sub":"33333333-0000-0000-0000-000000000063","org":"aaaaaaaa-0000-0000-0000-000000000013"}', true);
select is((select count(*)::int from notices.notices), 0, 'başka ofis görmez');

select * from finish();
