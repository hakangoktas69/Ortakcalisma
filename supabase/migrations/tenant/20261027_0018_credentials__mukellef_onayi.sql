-- credentials: mükellef onayı (CredentialConsent; D18, D46). Müşavir mükellefin (firmanın) kurum hesabını yalnız onayla kullanır.
-- Onay, müşavir ya da ofis yöneticisinin mükelleften aldığı yazılı onayı tarih ve yöntemle beyan etmesiyle kaydedilir; mükellef
-- kullanıcısı (bilgi girme izni olan) kendi firması için verebilir. Firma başına tek etkin onay; geri alınabilir; denetimli.
-- Firma hesabının sırrı onay yoksa hiçbir işe verilmez (credentials.secret_for_job, SQLSTATE EW001).
-- Mevcut veride: firma hesabıyla çalışan iş türü yoktu (sözleşme/beyanname müşavir hesabıyla); etki yok.

create table if not exists credentials.consents (
  org_id uuid not null references organization.organizations(id),
  id uuid not null default gen_random_uuid(),
  firm_id uuid not null,
  method text not null check (method in ('sozlesme', 'dilekce', 'eposta', 'diger')),
  consented_on date not null check (consented_on >= date '2000-01-01'),
  recorded_by uuid not null,
  recorded_at timestamptz not null default now(),
  revoked_at timestamptz,
  revoked_by uuid,
  primary key (org_id, id),
  foreign key (org_id, firm_id) references portfolio.firms(org_id, id)
);
create unique index if not exists consents_etkin on credentials.consents(org_id, firm_id) where revoked_at is null;

alter table credentials.consents enable row level security;
drop policy if exists oku on credentials.consents;
create policy oku on credentials.consents for select to authenticated using (app.is_system(org_id) or app.can_see_firm(org_id, firm_id));
grant select on credentials.consents to authenticated;

-- Onay verebilen: firmayı gören ofis yöneticisi/müşavir ya da bilgi girme izni olan mükellef kullanıcısı
create or replace function credentials.can_manage_consent(p_org uuid, p_firm uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select app.can_see_firm(p_org, p_firm) and (app.role_in(p_org) in ('ofis_admin', 'musavir') or (app.role_in(p_org) = 'mukellef' and exists (
    select 1 from portfolio.firm_users u where u.org_id = p_org and u.firm_id = p_firm and u.user_id = app.uid() and u.can_edit_credentials)))
$$;
revoke all on function credentials.can_manage_consent(uuid, uuid) from public;

create or replace function credentials.record_consent(p_org uuid, p_firm uuid, p_method text, p_date date) returns boolean
language plpgsql security definer set search_path = '' as $$
begin
  if not credentials.can_manage_consent(p_org, p_firm) then raise exception 'Mükellef onayı için yetki yok' using errcode = '42501'; end if;
  if p_method not in ('sozlesme', 'dilekce', 'eposta', 'diger') or p_date is null or p_date > current_date or p_date < date '2000-01-01' then
    raise exception 'Geçersiz onay bilgisi' using errcode = '22023';
  end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('onay:' || p_org || p_firm, 0));
  if exists (select 1 from credentials.consents c where c.org_id = p_org and c.firm_id = p_firm and c.revoked_at is null) then return false; end if;
  insert into credentials.consents(org_id, firm_id, method, consented_on, recorded_by) values (p_org, p_firm, p_method, p_date, app.uid());
  perform audit.record(p_org, 'mukellef_onayi.kaydedildi', p_firm::text, pg_catalog.jsonb_build_object('yontem', p_method, 'tarih', p_date));
  return true;
end $$;

create or replace function credentials.revoke_consent(p_org uuid, p_firm uuid) returns boolean
language plpgsql security definer set search_path = '' as $$
begin
  if not credentials.can_manage_consent(p_org, p_firm) then raise exception 'Mükellef onayı için yetki yok' using errcode = '42501'; end if;
  update credentials.consents set revoked_at = now(), revoked_by = app.uid() where org_id = p_org and firm_id = p_firm and revoked_at is null;
  if not found then return false; end if;
  perform audit.record(p_org, 'mukellef_onayi.geri_alindi', p_firm::text, '{}'::jsonb);
  return true;
end $$;

create or replace function credentials.has_consent(p_org uuid, p_firm uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from credentials.consents c where c.org_id = p_org and c.firm_id = p_firm and c.revoked_at is null)
$$;

revoke all on function credentials.record_consent(uuid, uuid, text, date), credentials.revoke_consent(uuid, uuid), credentials.has_consent(uuid, uuid) from public;
grant execute on function credentials.record_consent(uuid, uuid, text, date), credentials.revoke_consent(uuid, uuid), credentials.has_consent(uuid, uuid) to authenticated;

-- Entegrasyon: firma hesabının sırrı yalnız etkin mükellef onayı varken verilir (D18: işçi iş başlarken yeniden doğrular).
create or replace function credentials.secret_for_job(p_org uuid, p_job uuid) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare v_secret uuid; v_account uuid; v_status text; v_value text; v_owner_kind text; v_owner uuid;
begin
  if session_user <> 'eworks_integration' then raise exception 'Yalnız entegrasyon' using errcode = '42501'; end if;
  select a.secret_id, a.id, a.status, a.owner_kind, a.owner_id into v_secret, v_account, v_status, v_owner_kind, v_owner
    from sync.jobs j join credentials.institution_accounts a on a.org_id = j.org_id and a.id = j.account_id
   where j.org_id = p_org and j.id = p_job and j.status = 'running';
  if v_secret is null then raise exception 'Çalışan iş ya da hesap yok' using errcode = 'P0002'; end if;
  if v_status <> 'active' then raise exception 'Kurum hesabı kullanılamaz durumda' using errcode = '55000'; end if;
  if v_owner_kind = 'firm' and not exists (select 1 from credentials.consents c where c.org_id = p_org and c.firm_id = v_owner and c.revoked_at is null) then
    raise exception 'Mükellef onayı yok' using errcode = 'EW001';
  end if;
  select s.decrypted_secret into v_value from vault.decrypted_secrets s where s.id = v_secret;
  perform audit.append(p_org, null, 'system', 'kurum_hesabi.okundu', v_account::text, pg_catalog.jsonb_build_object('is', p_job));
  return v_value::jsonb;
end $$;
