-- Önce mevcut supabase-gib-vault.sql kurulmuş olmalıdır.
-- Şifreleri bu SQL'e veya eworks_state.payload'a yazmayın.
begin;
create table if not exists eworks_private.firm_gib_accounts (
  user_id uuid not null references auth.users(id) on delete cascade,
  firm_id text not null check (length(firm_id) between 1 and 160),
  secret_id uuid not null unique references vault.secrets(id),
  updated_at timestamptz not null default now(),
  primary key (user_id, firm_id)
);
alter table eworks_private.firm_gib_accounts enable row level security;
revoke all on eworks_private.firm_gib_accounts from public, anon, authenticated;

create or replace function public.eworks_firm_gib_credential_service(
  p_owner uuid, p_firm_id text, p_action text, p_credentials jsonb default null
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_firm jsonb; v_secret uuid; v_updated timestamptz; v_value text;
begin
  if p_owner is null or p_firm_id is null or length(p_firm_id) not between 1 and 160 then
    raise exception 'Invalid firm';
  end if;
  select f.value into v_firm from public.eworks_state s,
    lateral pg_catalog.jsonb_array_elements(s.payload->'firms') f(value)
    where s.user_id=p_owner and f.value->>'id'=p_firm_id;
  if v_firm is null then raise exception 'Firm not found for owner'; end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('eworks-firm-gib:'||p_owner::text||':'||p_firm_id,0));
  select secret_id,updated_at into v_secret,v_updated
    from eworks_private.firm_gib_accounts where user_id=p_owner and firm_id=p_firm_id;
  if p_action='status' then
    return pg_catalog.jsonb_build_object('configured',v_secret is not null,'updatedAt',v_updated,
      'scope','firm','firmId',p_firm_id);
  elsif p_action='save' then
    if pg_catalog.jsonb_typeof(p_credentials) is distinct from 'object'
      or pg_catalog.jsonb_typeof(p_credentials->'username') is distinct from 'string'
      or pg_catalog.jsonb_typeof(p_credentials->'password') is distinct from 'string'
      or length(trim(p_credentials->>'username')) not between 1 and 256
      or length(p_credentials->>'password') not between 1 and 1024 then
      raise exception 'Invalid credential format';
    end if;
    v_value:=pg_catalog.jsonb_build_object('username',trim(p_credentials->>'username'),
      'password',p_credentials->>'password')::text;
    if v_secret is null then
      v_secret:=vault.create_secret(v_value,'eworks-firm-gib-'||p_owner::text||'-'||p_firm_id,'Eworks firm GIB account');
      insert into eworks_private.firm_gib_accounts(user_id,firm_id,secret_id) values(p_owner,p_firm_id,v_secret);
    else
      perform vault.update_secret(v_secret,v_value);
      update eworks_private.firm_gib_accounts set updated_at=now() where user_id=p_owner and firm_id=p_firm_id;
    end if;
    return pg_catalog.jsonb_build_object('configured',true,'scope','firm','firmId',p_firm_id);
  elsif p_action='robot' then
    if v_secret is null then raise exception 'Firm account not configured'; end if;
    select decrypted_secret into v_value from vault.decrypted_secrets where id=v_secret;
    if v_value is null then raise exception 'Firm credential unavailable'; end if;
    return (v_value::jsonb)||pg_catalog.jsonb_build_object('ownerId',p_owner,'scope','firm','firmId',p_firm_id,
      'taxNumber',v_firm->>'taxNumber','identityNumber',v_firm->>'identityNumber');
  else
    raise exception 'Unknown operation';
  end if;
end;
$$;
revoke all on function public.eworks_firm_gib_credential_service(uuid,text,text,jsonb) from public, anon, authenticated;
grant execute on function public.eworks_firm_gib_credential_service(uuid,text,text,jsonb) to service_role;
commit;
