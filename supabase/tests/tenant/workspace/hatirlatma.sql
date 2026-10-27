-- @F:genel_bakis.takvim.remind
-- Kişisel hatırlatma: yalnız sahibi görür ve değiştirir; başka kullanıcı (yönetici dahil) görmez; kapsam dışı firmaya bağlanamaz.
select plan(7);

insert into organization.organizations(id, name) values ('aaaaaaaa-0000-0000-0000-00000000000f', 'F');
insert into organization.advisors(org_id, id, user_id, title) values
  ('aaaaaaaa-0000-0000-0000-00000000000f', 'adadadad-0000-0000-0000-000000000031', '11111111-0000-0000-0000-000000000031', 'M1'),
  ('aaaaaaaa-0000-0000-0000-00000000000f', 'adadadad-0000-0000-0000-000000000032', '22222222-0000-0000-0000-000000000032', 'M2');
insert into identity_access.memberships(org_id, user_id, role, display_name) values
  ('aaaaaaaa-0000-0000-0000-00000000000f', '11111111-0000-0000-0000-000000000031', 'musavir', 'M1'),
  ('aaaaaaaa-0000-0000-0000-00000000000f', '22222222-0000-0000-0000-000000000032', 'musavir', 'M2'),
  ('aaaaaaaa-0000-0000-0000-00000000000f', '33333333-0000-0000-0000-000000000033', 'ofis_admin', 'Y');
insert into portfolio.firms(org_id, id, advisor_id, title, kind, tax_id, tax_id_kind) values
  ('aaaaaaaa-0000-0000-0000-00000000000f', 'f1f1f1f1-0000-0000-0000-000000000031', 'adadadad-0000-0000-0000-000000000032', 'M2 Ltd', 'Limited', '1234567802', 'VKN');

select ok((select relrowsecurity from pg_class where oid = 'workspace.reminders'::regclass), 'RLS açık');

set local role authenticated;
select set_config('request.jwt.claims', '{"role":"authenticated","sub":"11111111-0000-0000-0000-000000000031","org":"aaaaaaaa-0000-0000-0000-00000000000f"}', true);
select lives_ok($$insert into workspace.reminders(org_id, user_id, title, remind_on, category, remind_days)
  values ('aaaaaaaa-0000-0000-0000-00000000000f', '11111111-0000-0000-0000-000000000031', 'KDV kontrolü', '2026-10-30', 'beyanname', 3)$$, 'sahibi hatırlatma ekler');
select throws_ok($$insert into workspace.reminders(org_id, user_id, title, remind_on, category, remind_days)
  values ('aaaaaaaa-0000-0000-0000-00000000000f', '22222222-0000-0000-0000-000000000032', 'Başkası adına', '2026-10-30', 'not', 0)$$, '42501', null, 'başkası adına hatırlatma eklenemez');
select throws_ok($$insert into workspace.reminders(org_id, user_id, title, remind_on, category, remind_days, firm_id)
  values ('aaaaaaaa-0000-0000-0000-00000000000f', '11111111-0000-0000-0000-000000000031', 'Kapsam dışı', '2026-10-30', 'not', 0, 'f1f1f1f1-0000-0000-0000-000000000031')$$,
  '42501', null, 'kapsam dışı firmaya bağlanamaz');
select is((select count(*)::int from workspace.reminders), 1, 'sahibi kendi hatırlatmasını görür');

select set_config('request.jwt.claims', '{"role":"authenticated","sub":"33333333-0000-0000-0000-000000000033","org":"aaaaaaaa-0000-0000-0000-00000000000f"}', true);
select is((select count(*)::int from workspace.reminders), 0, 'ofis yöneticisi de başkasının hatırlatmasını görmez');
update workspace.reminders set done = true;
reset role;
select is((select count(*)::int from workspace.reminders where org_id = 'aaaaaaaa-0000-0000-0000-00000000000f' and done), 0, 'başkası tamamlandı işaretleyemez');

select * from finish();
