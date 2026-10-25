-- audit: değiştirilemez denetim kaydı (06 §2, 05 §5). Her satır öncekinin özetini taşır (ofis başına hash zinciri).
-- Yazma yalnız audit.record() ile (tanımlayıcı hakları); güncelleme/silme yetkisi yok. Kişisel verinin kendisi yazılmaz, kimliği yazılır.

create schema if not exists audit;
grant usage on schema audit to authenticated;

create table audit.entries (
  org_id uuid not null references organization.organizations(id),
  id bigint generated always as identity,
  at timestamptz not null default now(),
  actor uuid,
  actor_kind text not null check (actor_kind in ('user', 'system')),
  action text not null check (action ~ '^[a-z_]+(\.[a-z_]+)+$'),
  subject text,
  details jsonb not null default '{}'::jsonb check (jsonb_typeof(details) = 'object' and octet_length(details::text) <= 4096),
  prev_hash text,
  hash text not null,
  primary key (org_id, id)
);

alter table audit.entries enable row level security;
-- Okuma: ofis yöneticisi ve sistem. Yazma politikası yok: yalnız audit.record()
create policy oku on audit.entries for select to authenticated using (app.role_in(org_id) = 'ofis_admin' or app.is_system(org_id));
grant select on audit.entries to authenticated;

create or replace function audit.record(p_org uuid, p_action text, p_subject text, p_details jsonb default '{}'::jsonb)
returns void language plpgsql security definer set search_path = '' as $$
declare
  v_actor uuid := app.uid();
  v_kind text := case when app.is_system(p_org) then 'system' else 'user' end;
  v_prev text;
  v_at timestamptz := clock_timestamp();
begin
  if not (app.is_member(p_org) or app.is_system(p_org)) then
    raise exception 'Denetim kaydı için ofis bağlamı gerekli' using errcode = '42501';
  end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('audit:' || p_org::text, 0));
  select e.hash into v_prev from audit.entries e where e.org_id = p_org order by e.id desc limit 1;
  insert into audit.entries(org_id, at, actor, actor_kind, action, subject, details, prev_hash, hash)
  values (p_org, v_at, v_actor, v_kind, p_action, p_subject, coalesce(p_details, '{}'::jsonb), v_prev,
          encode(extensions.digest(concat_ws('|', v_prev, p_org::text, v_at::text, v_actor::text, v_kind, p_action, p_subject, coalesce(p_details, '{}'::jsonb)::text), 'sha256'), 'hex'));
end $$;

revoke all on function audit.record(uuid, text, text, jsonb) from public;
grant execute on function audit.record(uuid, text, text, jsonb) to authenticated;
