-- @F:genel_bakis.takvim.view
-- Takvim kayıtları: ofis personeli okur, başka ofis görmez, web rolü yazamaz (yalnız işçi); tarihi yalnız ofis yöneticisi düzeltir (denetimli).
select plan(9);

insert into organization.organizations(id, name) values ('aaaaaaaa-0000-0000-0000-00000000000d', 'D'), ('aaaaaaaa-0000-0000-0000-00000000000e', 'E');
insert into identity_access.memberships(org_id, user_id, role, display_name) values
  ('aaaaaaaa-0000-0000-0000-00000000000d', '11111111-0000-0000-0000-000000000021', 'ofis_admin', 'Y'),
  ('aaaaaaaa-0000-0000-0000-00000000000d', '22222222-0000-0000-0000-000000000022', 'personel', 'P'),
  ('aaaaaaaa-0000-0000-0000-00000000000e', '33333333-0000-0000-0000-000000000023', 'ofis_admin', 'B');
insert into workspace.calendar_entries(org_id, id, year, entry_date, title, description, category, source, certainty) values
  ('aaaaaaaa-0000-0000-0000-00000000000d', 'kural:sgk-prim:2026-09', 2026, '2026-11-02', 'SGK prim ödemesi son günü', 'Açıklama', 'personel', 'kural', 'kesinlesmedi');

select ok((select relrowsecurity from pg_class where oid = 'workspace.calendar_entries'::regclass), 'RLS açık');

set local role authenticated;
select set_config('request.jwt.claims', '{"role":"authenticated","sub":"22222222-0000-0000-0000-000000000022","org":"aaaaaaaa-0000-0000-0000-00000000000d"}', true);
select is((select count(*)::int from workspace.calendar_entries), 1, 'personel kendi ofisinin takvimini görür');
select throws_ok($$insert into workspace.calendar_entries(org_id, id, year, entry_date, title, description, category, source, certainty)
  values ('aaaaaaaa-0000-0000-0000-00000000000d', 'x', 2026, '2026-01-01', 'X', 'X', 'diger', 'kural', 'kesin')$$, '42501', null, 'web rolü takvime yazamaz');
select throws_ok($$select workspace.correct_calendar_entry('aaaaaaaa-0000-0000-0000-00000000000d', 'kural:sgk-prim:2026-09', '2026-11-03')$$, '42501', null, 'personel tarihi düzeltemez');

select set_config('request.jwt.claims', '{"role":"authenticated","sub":"33333333-0000-0000-0000-000000000023","org":"aaaaaaaa-0000-0000-0000-00000000000e"}', true);
select is((select count(*)::int from workspace.calendar_entries), 0, 'başka ofis görmez');
select throws_ok($$select workspace.correct_calendar_entry('aaaaaaaa-0000-0000-0000-00000000000d', 'kural:sgk-prim:2026-09', '2026-11-03')$$, '42501', null, 'başka ofisin yöneticisi düzeltemez');

select set_config('request.jwt.claims', '{"role":"authenticated","sub":"11111111-0000-0000-0000-000000000021","org":"aaaaaaaa-0000-0000-0000-00000000000d"}', true);
select is(workspace.correct_calendar_entry('aaaaaaaa-0000-0000-0000-00000000000d', 'kural:sgk-prim:2026-09', '2026-11-03'), true, 'ofis yöneticisi düzeltir');
select is((select to_char(corrected_date, 'YYYY-MM-DD') from workspace.calendar_entries where id = 'kural:sgk-prim:2026-09'), '2026-11-03', 'düzeltme kaydedildi');
reset role;
select is((select count(*)::int from audit.entries where org_id = 'aaaaaaaa-0000-0000-0000-00000000000d' and action = 'takvim.tarih_duzeltildi'), 1, 'düzeltme denetim kaydında');

select * from finish();
