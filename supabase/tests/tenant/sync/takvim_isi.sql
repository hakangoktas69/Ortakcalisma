-- @F:genel_bakis.takvim.sync
-- Takvim kaynakları işi kurum hesabı kullanmaz (kamuya açık kaynak); diğer iş türleri hesapsız açılamaz. Kullanıcı yalnız
-- kendi adına iş açar; hesapsız (sistem) işi yalnız işçi açar.
select plan(4);

insert into organization.organizations(id, name) values ('aaaaaaaa-0000-0000-0000-000000000010', 'T');
insert into identity_access.memberships(org_id, user_id, role, display_name) values
  ('aaaaaaaa-0000-0000-0000-000000000010', '11111111-0000-0000-0000-000000000041', 'ofis_admin', 'Y');

set local role authenticated;
select set_config('request.jwt.claims', '{"role":"authenticated","sub":"11111111-0000-0000-0000-000000000041","org":"aaaaaaaa-0000-0000-0000-000000000010"}', true);
select lives_ok($$insert into sync.jobs(org_id, kind, account_id, requested_by, params)
  values ('aaaaaaaa-0000-0000-0000-000000000010', 'takvim.kaynaklar', null, '11111111-0000-0000-0000-000000000041', '{"year": 2027}')$$, 'takvim işi hesapsız açılır');
select throws_ok($$insert into sync.jobs(org_id, kind, account_id, requested_by)
  values ('aaaaaaaa-0000-0000-0000-000000000010', 'gib.sozlesmeler', null, '11111111-0000-0000-0000-000000000041')$$, '23514', null, 'kurum işi hesapsız açılamaz');
select throws_ok($$insert into sync.jobs(org_id, kind, account_id, requested_by, params)
  values ('aaaaaaaa-0000-0000-0000-000000000010', 'takvim.kaynaklar', null, null, '{"year": 2027}')$$, '42501', null, 'kullanıcı sistem adına (isteyensiz) iş açamaz');
select throws_ok($$insert into sync.jobs(org_id, kind, account_id, requested_by)
  values ('aaaaaaaa-0000-0000-0000-000000000010', 'bilinmeyen.is', null, '11111111-0000-0000-0000-000000000041')$$, '23514', null, 'bilinmeyen iş türü reddedilir');

select * from finish();
