-- sales (D27, D40): shard'da hesap açma fonksiyonları. Satış uygulaması `eworks_sales` rolüyle bağlanır; bu rolün hiçbir
-- tabloya yetkisi yoktur ve `authenticated` üyesi değildir: mükellef iş verisini (beyanname, SGK, belge) veritabanı düzeyinde
-- göremez. Yalnız aşağıdaki fonksiyonları çağırır. Hesap açma komutu (`eworks_worker`) aynı fonksiyonları kullanır.
-- Ofisi etkileyen her işlem ofisin denetim kaydına yazılır (satış portalından gelen işlemde satış kullanıcısının kimliğiyle).
-- audit.record'un ofis bağlamı denetimi değişmez; yazma ve hash zinciri iç fonksiyona (audit.append) ayrılır, hesap aynıdır.
-- Mevcut veride etki: yok (yeni rol, şema, fonksiyon; audit.record davranışı aynı). Geri dönüş: yeni migration ile.

do $$ begin
  if not exists (select from pg_roles where rolname = 'eworks_sales') then create role eworks_sales login noinherit; end if;
end $$;

-- Denetim kaydına yazmanın tek yolu (iç): yalnız tanımlayıcı haklarıyla çalışan fonksiyonlar çağırır, hiçbir role açık değildir.
create or replace function audit.append(p_org uuid, p_actor uuid, p_kind text, p_action text, p_subject text, p_details jsonb)
returns void language plpgsql security definer set search_path = '' as $$
declare
  v_prev text;
  v_at timestamptz := clock_timestamp();
begin
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('audit:' || p_org::text, 0));
  select e.hash into v_prev from audit.entries e where e.org_id = p_org order by e.id desc limit 1;
  insert into audit.entries(org_id, at, actor, actor_kind, action, subject, details, prev_hash, hash)
  values (p_org, v_at, p_actor, p_kind, p_action, p_subject, coalesce(p_details, '{}'::jsonb), v_prev,
          encode(extensions.digest(concat_ws('|', v_prev, p_org::text, v_at::text, p_actor::text, p_kind, p_action, p_subject, coalesce(p_details, '{}'::jsonb)::text), 'sha256'), 'hex'));
end $$;
revoke all on function audit.append(uuid, uuid, text, text, text, jsonb) from public;

create or replace function audit.record(p_org uuid, p_action text, p_subject text, p_details jsonb default '{}'::jsonb)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if not (app.is_member(p_org) or app.is_system(p_org)) then
    raise exception 'Denetim kaydı için ofis bağlamı gerekli' using errcode = '42501';
  end if;
  perform audit.append(p_org, app.uid(), case when app.is_system(p_org) then 'system' else 'user' end, p_action, p_subject, p_details);
end $$;

create schema if not exists sales;
revoke all on schema sales from public;
grant usage on schema sales to eworks_sales, eworks_worker;

-- İşlemin kaynağı denetim kaydına: satış portalı (ve satış kullanıcısı) ya da hesap açma komutu
create or replace function sales.source(p_by uuid) returns jsonb
language sql stable set search_path = '' as $$
  select jsonb_build_object('kaynak', case when session_user = 'eworks_sales' then 'satis_portali' else 'hesap_acma_komutu' end)
         || case when p_by is null then '{}'::jsonb else jsonb_build_object('satis_kullanici', p_by::text) end
$$;

create or replace function sales.open_organization(p_org uuid, p_name text, p_by uuid default null)
returns void language plpgsql security definer set search_path = '' as $$
begin
  insert into organization.organizations(id, name) values (p_org, p_name) on conflict (id) do nothing;
  if found then
    perform audit.append(p_org, null, 'system', 'hesap.ofis_acildi', p_org::text, sales.source(p_by));
  end if;
end $$;

-- Satış rolü yalnız henüz üyesi olmayan (yeni açılan) ofise üye ekler: satış uygulaması ya da parolası ele geçse bile
-- var olan bir müşteri ofisine kendini yönetici yapıp iş verisine ulaşamaz. Var olan ofise ekleme (müşavir/mükellef
-- hesabı, sonraki aşama) ayrı ve dar bir fonksiyonla gelir. Hesap açma komutu (eworks_worker) bu kısıta tabi değildir.
create or replace function sales.add_member(p_org uuid, p_user uuid, p_role text, p_display_name text, p_advisor uuid default null, p_by uuid default null)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if session_user = 'eworks_sales' and exists (select 1 from identity_access.memberships m where m.org_id = p_org) then
    raise exception 'Satış yalnız yeni açılan ofise üye ekler' using errcode = '42501';
  end if;
  insert into identity_access.memberships(org_id, user_id, role, display_name) values (p_org, p_user, p_role, p_display_name);
  if p_advisor is not null then
    insert into organization.advisors(org_id, id, user_id, title) values (p_org, p_advisor, p_user, p_display_name);
  end if;
  perform audit.append(p_org, null, 'system', 'hesap.uye_eklendi', p_user::text, sales.source(p_by) || jsonb_build_object('rol', p_role));
end $$;

create or replace function sales.is_member(p_org uuid, p_user uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from identity_access.memberships m where m.org_id = p_org and m.user_id = p_user)
$$;

revoke all on all functions in schema sales from public;
grant execute on function sales.open_organization(uuid, text, uuid), sales.add_member(uuid, uuid, text, text, uuid, uuid), sales.is_member(uuid, uuid)
  to eworks_sales, eworks_worker;
