-- sync: kurum işleri ve transactional outbox (02 §5, 01 §3). İş, isteyenin işlemiyle aynı işlemde outbox'a yazılır;
-- işçi outbox'ı RabbitMQ'ya taşır. Mesajda yalnız kimlikler bulunur (iş, ofis, shard); kapsam ve durum burada.
-- Entegrasyon rolü (Python ACL) tabloya erişemez; yalnız işi sahiplenen ve o işin kurum hesabı sırrını okuyan fonksiyonları çağırır.

create schema if not exists sync;
grant usage on schema sync to authenticated, eworks_integration;
grant usage on schema credentials to eworks_integration;

create table sync.jobs (
  org_id uuid not null references organization.organizations(id),
  id uuid not null default gen_random_uuid(),
  kind text not null check (kind in ('gib.sozlesmeler', 'gib.beyannameler')),
  account_id uuid not null,
  requested_by uuid not null,
  status text not null default 'queued' check (status in ('queued', 'running', 'succeeded', 'failed', 'wrong_password', 'cancelled')),
  params jsonb not null default '{}'::jsonb check (jsonb_typeof(params) = 'object' and octet_length(params::text) <= 8192),
  status_message text check (length(status_message) <= 500),
  result_summary jsonb,
  attempts int not null default 0,
  created_at timestamptz not null default now(),
  started_at timestamptz,
  finished_at timestamptz,
  primary key (org_id, id),
  foreign key (org_id, account_id) references credentials.institution_accounts(org_id, id)
);
create index jobs_aktif on sync.jobs(org_id, kind, account_id) where status in ('queued', 'running');
create index jobs_son on sync.jobs(org_id, created_at desc);

create table sync.outbox (
  org_id uuid not null,
  id bigint generated always as identity,
  topic text not null check (topic ~ '^[a-z]+(\.[a-z_]+)+$'),
  payload jsonb not null check (octet_length(payload::text) <= 2048),
  created_at timestamptz not null default now(),
  published_at timestamptz,
  primary key (org_id, id)
);
create index outbox_bekleyen on sync.outbox(created_at) where published_at is null;

alter table sync.jobs enable row level security;
alter table sync.outbox enable row level security;
create policy oku on sync.jobs for select to authenticated using (app.is_member(org_id) or app.is_system(org_id));
create policy ekle on sync.jobs for insert to authenticated with check (app.is_member(org_id) and requested_by = app.uid() and status = 'queued');
create policy guncelle on sync.jobs for update to authenticated using (app.is_system(org_id)) with check (app.is_system(org_id));
create policy ekle on sync.outbox for insert to authenticated with check (app.is_member(org_id) or app.is_system(org_id));
create policy oku on sync.outbox for select to authenticated using (app.is_system(org_id));
grant select, insert, update on sync.jobs to authenticated;
grant select, insert on sync.outbox to authenticated;

-- Outbox taşıyıcı (işçi): ofisler arası bekleyen kayıtları okur ve yayımlandı işaretler. Yalnız işçi oturumunda.
create or replace function sync.pending_outbox(p_limit int) returns table(org_id uuid, id bigint, topic text, payload jsonb)
language plpgsql security definer set search_path = '' as $$
begin
  if session_user <> 'eworks_worker' then raise exception 'Yalnız işçi' using errcode = '42501'; end if;
  return query select o.org_id, o.id, o.topic, o.payload from sync.outbox o where o.published_at is null order by o.created_at limit least(p_limit, 500);
end $$;

create or replace function sync.mark_published(p_org uuid[], p_id bigint[]) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if session_user <> 'eworks_worker' then raise exception 'Yalnız işçi' using errcode = '42501'; end if;
  update sync.outbox o set published_at = now() from unnest(p_org, p_id) as u(org_id, id) where o.org_id = u.org_id and o.id = u.id;
end $$;

revoke all on function sync.pending_outbox(int), sync.mark_published(uuid[], bigint[]) from public;
grant execute on function sync.pending_outbox(int), sync.mark_published(uuid[], bigint[]) to authenticated;

-- Denetim kaydına yetki denetimi olmadan ekleme (iç kullanım): audit.record yetkiyi denetleyip buna devreder;
-- entegrasyon fonksiyonları sistem adına doğrudan çağırır. Hiçbir role verilmez.
create or replace function audit.append(p_org uuid, p_actor uuid, p_kind text, p_action text, p_subject text, p_details jsonb)
returns void language plpgsql security definer set search_path = '' as $$
declare v_prev text; v_at timestamptz := clock_timestamp();
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

-- Entegrasyon: işi sahiplen (yalnız kuyruktaysa) → tür, hesap, parametreler.
create or replace function sync.claim_job(p_org uuid, p_job uuid) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare r record;
begin
  if session_user <> 'eworks_integration' then raise exception 'Yalnız entegrasyon' using errcode = '42501'; end if;
  update sync.jobs j set status = 'running', started_at = now(), attempts = j.attempts + 1, status_message = 'Kuruma bağlanılıyor.'
   where j.org_id = p_org and j.id = p_job and j.status = 'queued'
  returning j.kind, j.account_id, j.params into r;
  if not found then return null; end if;
  return pg_catalog.jsonb_build_object('kind', r.kind, 'accountId', r.account_id, 'params', r.params);
end $$;

-- Entegrasyon: çalışan işin kurum hesabı sırrı (05 §4). Hesap kullanılamaz durumdaysa (hatalı şifre/kilit) verilmez.
-- Her okuma denetim kaydına yazılır; sır değeri kaydedilmez.
create or replace function credentials.secret_for_job(p_org uuid, p_job uuid) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare v_secret uuid; v_account uuid; v_status text; v_value text;
begin
  if session_user <> 'eworks_integration' then raise exception 'Yalnız entegrasyon' using errcode = '42501'; end if;
  select a.secret_id, a.id, a.status into v_secret, v_account, v_status
    from sync.jobs j join credentials.institution_accounts a on a.org_id = j.org_id and a.id = j.account_id
   where j.org_id = p_org and j.id = p_job and j.status = 'running';
  if v_secret is null then raise exception 'Çalışan iş ya da hesap yok' using errcode = 'P0002'; end if;
  if v_status <> 'active' then raise exception 'Kurum hesabı kullanılamaz durumda' using errcode = '55000'; end if;
  select s.decrypted_secret into v_value from vault.decrypted_secrets s where s.id = v_secret;
  perform audit.append(p_org, null, 'system', 'kurum_hesabi.okundu', v_account::text, pg_catalog.jsonb_build_object('is', p_job));
  return v_value::jsonb;
end $$;

revoke all on function sync.claim_job(uuid, uuid), credentials.secret_for_job(uuid, uuid) from public;
grant execute on function sync.claim_job(uuid, uuid), credentials.secret_for_job(uuid, uuid) to eworks_integration;

-- Hatalı şifre / başarı: işçi (sistem bağlamı) hesap durumunu günceller (05 §4: hatalı şifreli hesap yeniden denenmez)
create policy guncelle on credentials.institution_accounts for update to authenticated using (app.is_system(org_id)) with check (app.is_system(org_id));
grant update (status, consecutive_failures, next_allowed_at, last_success_at) on credentials.institution_accounts to authenticated;
