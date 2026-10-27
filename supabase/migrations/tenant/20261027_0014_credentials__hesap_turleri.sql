-- credentials: kurum hesabı türleri (Mert 26.10 kurum bilgi kartları → Vault). SGK hesabı işyeri başınadır: bir firmanın
-- birden çok SGK işyeri hesabı olabilir, tabloda yalnız işyeri adı (etiket) durur; kullanıcı adı, işyeri kodu, sistem ve
-- işyeri şifresi Vault sırrındadır. UETS (adres + şifre) eklenir. e-Devlet şifresi saklanmaz (kullanım koşulları, KVKK).
--
-- Mevcut veride: GİB hesapları label = '' ile aynen kalır, sır biçimleri ({username, password}) değişmez; entegrasyonun
-- okuduğu credentials.secret_for_job() etkilenmez. Geri dönüş gerekirse yeni bir migration tekillik kısıtını eski hâline alır
-- (önce SGK'da etiketli ikinci hesaplar ayıklanmalıdır).

alter table credentials.institution_accounts add column if not exists label text not null default '';

do $$
begin
  if not exists (select 1 from pg_constraint where conrelid = 'credentials.institution_accounts'::regclass and conname = 'institution_accounts_label_check') then
    alter table credentials.institution_accounts add constraint institution_accounts_label_check check (length(label) <= 80 and label = btrim(label));
  end if;
  alter table credentials.institution_accounts drop constraint if exists institution_accounts_institution_check;
  alter table credentials.institution_accounts add constraint institution_accounts_institution_check check (institution in ('GIB', 'SGK', 'UETS'));
  alter table credentials.institution_accounts drop constraint if exists institution_accounts_org_id_owner_kind_owner_id_institution_key;
  if not exists (select 1 from pg_constraint where conrelid = 'credentials.institution_accounts'::regclass and conname = 'institution_accounts_sahip_kurum_etiket_key') then
    alter table credentials.institution_accounts add constraint institution_accounts_sahip_kurum_etiket_key unique (org_id, owner_kind, owner_id, institution, label);
  end if;
end $$;

grant select (label) on credentials.institution_accounts to authenticated;

/**
 * Kurum hesabı kaydet/güncelle (alan tabanlı). Yetki save_account ile aynı (05 §4, D18): müşavir hesabı → sahibi müşavir ya da
 * ofis yöneticisi; firma hesabı → firmayı gören ofis yöneticisi/müşavir ya da izinli mükellef kullanıcısı. Alanlar kuruma göre
 * tam olarak beklenen anahtarlardır (eksik/fazla → 22023); SGK ve UETS yalnız firmanın, SGK işyeri adı ister.
 * Sır hiçbir tabloya ve denetim kaydına yazılmaz; yalnız Vault'a. Dönüş: yalnız hesap kimliği.
 */
create or replace function credentials.save_account_secret(p_org uuid, p_owner_kind text, p_owner_id uuid, p_institution text, p_label text, p_secret jsonb)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_role text := app.role_in(p_org);
  v_keys text[];
  v_label text := coalesce(p_label, '');
  v_secret uuid;
  v_id uuid;
  v_key text;
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

  v_keys := case p_institution
    when 'GIB' then array['password', 'username']
    when 'SGK' then array['systemPassword', 'username', 'workplaceCode', 'workplacePassword']
    when 'UETS' then array['address', 'password']
  end;
  if v_keys is null or (p_institution in ('SGK', 'UETS') and p_owner_kind <> 'firm')
     or (p_institution = 'SGK') <> (v_label <> '') or length(v_label) > 80 or v_label <> pg_catalog.btrim(v_label)
     or p_secret is null or pg_catalog.jsonb_typeof(p_secret) <> 'object'
     or (select pg_catalog.array_agg(k order by k) from pg_catalog.jsonb_object_keys(p_secret) k) is distinct from v_keys then
    raise exception 'Geçersiz kimlik bilgisi biçimi' using errcode = '22023';
  end if;
  foreach v_key in array v_keys loop
    if pg_catalog.jsonb_typeof(p_secret -> v_key) <> 'string' or length(p_secret ->> v_key) not between 1 and 1024 then
      raise exception 'Geçersiz kimlik bilgisi biçimi' using errcode = '22023';
    end if;
  end loop;

  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('cred:' || p_org || p_owner_kind || p_owner_id || p_institution || ':' || v_label, 0));
  select a.secret_id, a.id into v_secret, v_id from credentials.institution_accounts a
   where a.org_id = p_org and a.owner_kind = p_owner_kind and a.owner_id = p_owner_id and a.institution = p_institution and a.label = v_label;
  if v_secret is null then
    v_secret := vault.create_secret(p_secret::text, 'eworks:' || p_org || ':' || gen_random_uuid(), 'Eworks kurum hesabı');
    insert into credentials.institution_accounts(org_id, owner_kind, owner_id, institution, label, secret_id, updated_by)
    values (p_org, p_owner_kind, p_owner_id, p_institution, v_label, v_secret, app.uid()) returning id into v_id;
  else
    perform vault.update_secret(v_secret, p_secret::text);
    -- Yeni bilgi girildi: hatalı şifre/kilit durumu sıfırlanır (05 §4: wrong_password hesap yeniden denenmez, ta ki bilgi değişene dek)
    update credentials.institution_accounts set status = 'active', consecutive_failures = 0, next_allowed_at = null, updated_by = app.uid(), updated_at = now()
     where org_id = p_org and id = v_id;
  end if;
  perform audit.record(p_org, 'kurum_hesabi.kaydedildi', v_id::text, pg_catalog.jsonb_build_object('sahip', p_owner_kind, 'kurum', p_institution));
  return pg_catalog.jsonb_build_object('configured', true, 'accountId', v_id);
end $$;

revoke all on function credentials.save_account_secret(uuid, text, uuid, text, text, jsonb) from public;
grant execute on function credentials.save_account_secret(uuid, text, uuid, text, text, jsonb) to authenticated;

-- Eski GİB yolu (kullanıcı adı + şifre) yeni fonksiyona devredilir: aynı yetki, aynı sır biçimi, etiketsiz.
create or replace function credentials.save_account(p_org uuid, p_owner_kind text, p_owner_id uuid, p_institution text, p_username text, p_password text)
returns jsonb language plpgsql security definer set search_path = '' as $$
begin
  if p_institution <> 'GIB' or p_username is null or length(pg_catalog.btrim(p_username)) not between 1 and 256 then
    raise exception 'Geçersiz kimlik bilgisi biçimi' using errcode = '22023';
  end if;
  return credentials.save_account_secret(p_org, p_owner_kind, p_owner_id, p_institution, '',
    pg_catalog.jsonb_build_object('username', pg_catalog.btrim(p_username), 'password', p_password));
end $$;
