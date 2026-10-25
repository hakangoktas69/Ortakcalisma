-- credentials: kurum hesabı (05 §4, D8, D17, D18). Kimlik bilgisi yalnız Vault'ta; tabloda yalnız sır kimliği ve durum.
-- Tarayıcı ve web rolü sırrı hiçbir yoldan okuyamaz (yalnız durum). Sırrı yalnız entegrasyon rolü, çalışan bir iş için okur (aşama D).
-- Her kayıt/okuma denetim kaydına yazılır (audit.record).

create extension if not exists supabase_vault with schema vault;
create schema if not exists credentials;
grant usage on schema credentials to authenticated;

create table credentials.institution_accounts (
  org_id uuid not null references organization.organizations(id),
  id uuid not null default gen_random_uuid(),
  owner_kind text not null check (owner_kind in ('advisor', 'firm')),
  owner_id uuid not null,
  institution text not null check (institution in ('GIB', 'SGK')),
  secret_id uuid not null unique,
  status text not null default 'active' check (status in ('active', 'wrong_password', 'locked', 'disabled')),
  consecutive_failures int not null default 0,
  next_allowed_at timestamptz,
  last_success_at timestamptz,
  updated_by uuid,
  updated_at timestamptz not null default now(),
  primary key (org_id, id),
  unique (org_id, owner_kind, owner_id, institution)
);

alter table credentials.institution_accounts enable row level security;
-- Durum görünürlüğü: firma hesabı firmayı görebilene; müşavir hesabı ofis üyelerine (personel izinle kullanabilir, D17)
create policy oku on credentials.institution_accounts for select to authenticated using (
  app.is_system(org_id) or (owner_kind = 'firm' and app.can_see_firm(org_id, owner_id)) or (owner_kind = 'advisor' and app.is_member(org_id)));
-- secret_id sütunu dahil seçilebilir ama vault şemasına erişim yok; sırrı yalnız tanımlayıcı fonksiyonlar çözer
grant select (org_id, id, owner_kind, owner_id, institution, status, consecutive_failures, next_allowed_at, last_success_at, updated_at)
  on credentials.institution_accounts to authenticated;

/**
 * Kurum hesabı kaydet/güncelle. Yetki: müşavir hesabı → hesabın sahibi müşavir ya da ofis yöneticisi;
 * firma hesabı → firmayı gören ofis yöneticisi/müşavir ya da firmaya bağlı mükellef kullanıcısı (D18).
 * Şifre hiçbir tabloya ve denetim kaydına yazılmaz; yalnız Vault'a. Dönüş: yalnız durum.
 */
create or replace function credentials.save_account(p_org uuid, p_owner_kind text, p_owner_id uuid, p_institution text, p_username text, p_password text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_role text := app.role_in(p_org);
  v_secret uuid;
  v_value text;
  v_id uuid;
begin
  if p_owner_kind = 'advisor' then
    if not (v_role = 'ofis_admin' or (v_role = 'musavir' and p_owner_id = app.my_advisor(p_org))) then
      raise exception 'Kurum hesabı için yetki yok' using errcode = '42501';
    end if;
    if not exists (select 1 from organization.advisors a where a.org_id = p_org and a.id = p_owner_id) then
      raise exception 'Müşavir bulunamadı' using errcode = 'P0002';
    end if;
  elsif p_owner_kind = 'firm' then
    if not (app.can_see_firm(p_org, p_owner_id) and (v_role in ('ofis_admin', 'musavir') or (v_role = 'mukellef' and exists (
      select 1 from portfolio.firm_users u where u.org_id = p_org and u.firm_id = p_owner_id and u.user_id = app.uid() and u.can_edit_credentials)))) then
      raise exception 'Kurum hesabı için yetki yok' using errcode = '42501';
    end if;
  else
    raise exception 'Geçersiz hesap sahibi' using errcode = '22023';
  end if;
  if p_institution not in ('GIB', 'SGK') or p_username is null or length(trim(p_username)) not between 1 and 256
     or p_password is null or length(p_password) not between 1 and 1024 then
    raise exception 'Geçersiz kimlik bilgisi biçimi' using errcode = '22023';
  end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('cred:' || p_org || p_owner_kind || p_owner_id || p_institution, 0));
  v_value := pg_catalog.jsonb_build_object('username', trim(p_username), 'password', p_password)::text;
  select a.secret_id, a.id into v_secret, v_id from credentials.institution_accounts a
   where a.org_id = p_org and a.owner_kind = p_owner_kind and a.owner_id = p_owner_id and a.institution = p_institution;
  if v_secret is null then
    v_secret := vault.create_secret(v_value, 'eworks:' || p_org || ':' || gen_random_uuid(), 'Eworks kurum hesabı');
    insert into credentials.institution_accounts(org_id, owner_kind, owner_id, institution, secret_id, updated_by)
    values (p_org, p_owner_kind, p_owner_id, p_institution, v_secret, app.uid()) returning id into v_id;
  else
    perform vault.update_secret(v_secret, v_value);
    -- Yeni bilgi girildi: hatalı şifre/kilit durumu sıfırlanır (05 §4: wrong_password hesap yeniden denenmez, ta ki bilgi değişene dek)
    update credentials.institution_accounts set status = 'active', consecutive_failures = 0, next_allowed_at = null, updated_by = app.uid(), updated_at = now()
     where org_id = p_org and id = v_id;
  end if;
  perform audit.record(p_org, 'kurum_hesabi.kaydedildi', v_id::text, pg_catalog.jsonb_build_object('sahip', p_owner_kind, 'kurum', p_institution));
  return pg_catalog.jsonb_build_object('configured', true, 'accountId', v_id);
end $$;

revoke all on function credentials.save_account(uuid, text, uuid, text, text, text) from public;
grant execute on function credentials.save_account(uuid, text, uuid, text, text, text) to authenticated;
