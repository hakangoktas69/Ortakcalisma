-- Portföy RLS ve kurum hesabı yetkileri: kimlik bilgisi tablodan okunamaz, kapsam dışı firma görünmez.
select plan(7);

insert into organization.organizations(id, name) values ('aaaaaaaa-0000-0000-0000-00000000000a', 'A');
insert into organization.advisors(org_id, id, user_id, title) values
  ('aaaaaaaa-0000-0000-0000-00000000000a', 'adadadad-0000-0000-0000-000000000001', '11111111-0000-0000-0000-000000000001', 'M1'),
  ('aaaaaaaa-0000-0000-0000-00000000000a', 'adadadad-0000-0000-0000-000000000002', '22222222-0000-0000-0000-000000000002', 'M2');
insert into identity_access.memberships(org_id, user_id, role, display_name) values
  ('aaaaaaaa-0000-0000-0000-00000000000a', '11111111-0000-0000-0000-000000000001', 'musavir', 'M1'),
  ('aaaaaaaa-0000-0000-0000-00000000000a', '22222222-0000-0000-0000-000000000002', 'musavir', 'M2');
insert into portfolio.firms(org_id, id, advisor_id, title, kind, tax_id, tax_id_kind) values
  ('aaaaaaaa-0000-0000-0000-00000000000a', 'f1f1f1f1-0000-0000-0000-000000000001', 'adadadad-0000-0000-0000-000000000001', 'M1 Ltd', 'Limited', '1234567890', 'VKN');

select ok(not has_column_privilege('authenticated', 'credentials.institution_accounts', 'secret_id', 'SELECT'), 'sır kimliği sütunu web rolüne kapalı');
select ok(not has_schema_privilege('authenticated', 'vault', 'USAGE'), 'Vault şeması web rolüne kapalı');
select ok(not has_table_privilege('authenticated', 'audit.entries', 'UPDATE') and not has_table_privilege('authenticated', 'audit.entries', 'DELETE'), 'denetim kaydı değiştirilemez');
select throws_ok($$insert into portfolio.firms(org_id, id, advisor_id, title, kind, tax_id, tax_id_kind) values
  ('aaaaaaaa-0000-0000-0000-00000000000a', gen_random_uuid(), 'adadadad-0000-0000-0000-000000000001', 'Kopya', 'Limited', '1234567890', 'VKN')$$, '23505', null, 'ofis içinde aynı aktif VKN ikinci kez eklenemez');

set local role authenticated;
select set_config('request.jwt.claims', '{"role":"authenticated","sub":"22222222-0000-0000-0000-000000000002","org":"aaaaaaaa-0000-0000-0000-00000000000a"}', true);
select is((select count(*)::int from portfolio.firms), 0, 'müşavir başka müşavirin firmasını göremez');
select throws_ok($$select credentials.save_account('aaaaaaaa-0000-0000-0000-00000000000a', 'firm', 'f1f1f1f1-0000-0000-0000-000000000001', 'GIB', 'k', 'p')$$, '42501', null, 'kapsam dışı firmanın kurum hesabı girilemez');

select set_config('request.jwt.claims', '{"role":"authenticated","sub":"11111111-0000-0000-0000-000000000001","org":"aaaaaaaa-0000-0000-0000-00000000000a"}', true);
select is((select count(*)::int from portfolio.firms), 1, 'müşavir kendi firmasını görür');

select * from finish();
