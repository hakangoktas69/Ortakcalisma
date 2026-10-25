-- Üyelik RLS (05 §3.4): kullanıcı yalnız etkin ofisinin üyelerini görür; yazma yalnız sistem bağlamında.
select plan(6);

insert into organization.organizations(id, name) values
  ('aaaaaaaa-0000-0000-0000-000000000001', 'A'), ('bbbbbbbb-0000-0000-0000-000000000002', 'B');
insert into identity_access.memberships(org_id, user_id, role, display_name) values
  ('aaaaaaaa-0000-0000-0000-000000000001', '11111111-0000-0000-0000-000000000001', 'musavir', 'A müşaviri'),
  ('bbbbbbbb-0000-0000-0000-000000000002', '22222222-0000-0000-0000-000000000002', 'musavir', 'B müşaviri');
insert into identity_access.permission_overrides(org_id, user_id, key, effect, granted_by) values
  ('aaaaaaaa-0000-0000-0000-000000000001', '11111111-0000-0000-0000-000000000001', 'sgk', 'deny', '11111111-0000-0000-0000-000000000001');

set local role authenticated;
select set_config('request.jwt.claims', '{"role":"authenticated","sub":"11111111-0000-0000-0000-000000000001","org":"aaaaaaaa-0000-0000-0000-000000000001"}', true);

select is((select count(*)::int from identity_access.memberships), 1, 'yalnız etkin ofisin üyeleri görünür');
select is((select count(*)::int from organization.organizations), 1, 'başka ofis görünmez');
select is((select count(*)::int from identity_access.permission_overrides), 1, 'kişi kendi izin/engelini görür');
select throws_ok($$insert into identity_access.memberships(org_id, user_id, role, display_name) values ('aaaaaaaa-0000-0000-0000-000000000001', '33333333-0000-0000-0000-000000000003', 'ofis_admin', 'x')$$,
  '42501', null, 'kullanıcı kendine üyelik/rol yazamaz');

select set_config('request.jwt.claims', '{"role":"authenticated","sub":"11111111-0000-0000-0000-000000000001","org":"bbbbbbbb-0000-0000-0000-000000000002"}', true);
select is((select count(*)::int from identity_access.memberships), 0, 'üyesi olmadığı ofisi etkin seçse de göremez');
select is(app.role_in('bbbbbbbb-0000-0000-0000-000000000002'), null, 'üye olmadığı ofiste rolü yok');

select * from finish();
