-- Shard temeli: giriş rolleri RLS'i atlatamaz, sistem bağlamını yalnız işçi rolü kurabilir (D34).
select plan(9);

select has_role('eworks_app', 'web giriş rolü var');
select has_role('eworks_worker', 'işçi giriş rolü var');
select has_role('eworks_integration', 'entegrasyon giriş rolü var');
select ok(not (select rolinherit from pg_roles where rolname = 'eworks_app'), 'eworks_app NOINHERIT (rol değiştirmeden yetkisiz)');
select is((select count(*)::int from pg_roles where rolname in ('eworks_app', 'eworks_worker', 'eworks_integration') and rolbypassrls), 0, 'hiçbir uygulama rolü BYPASSRLS değil');
select ok(not pg_has_role('eworks_integration', 'authenticated', 'member'), 'entegrasyon rolü authenticated üyesi değil');

select set_config('request.jwt.claims', '{"role":"authenticated","sub":"11111111-1111-1111-1111-111111111111","org":"22222222-2222-2222-2222-222222222222"}', true);
select is(app.uid(), '11111111-1111-1111-1111-111111111111'::uuid, 'app.uid() claim''deki kullanıcıyı verir');
select is(app.active_org(), '22222222-2222-2222-2222-222222222222'::uuid, 'app.active_org() etkin ofisi verir');

select set_config('request.jwt.claims', '{"role":"system","org":"22222222-2222-2222-2222-222222222222"}', true);
select ok(not app.is_system('22222222-2222-2222-2222-222222222222'), 'sistem claim''i işçi dışındaki oturumda geçersiz');

select * from finish();
