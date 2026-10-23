-- Projenin SQL Editor'ünde çalıştırın. Gerçek giriş bilgisi bu dosyaya yazılmaz.
begin;
create extension if not exists supabase_vault with schema vault;
create schema if not exists eworks_private;
revoke all on schema eworks_private from public, anon, authenticated;
create table if not exists eworks_private.gib_accounts (
  user_id uuid primary key references auth.users(id) on delete cascade,
  secret_id uuid not null unique references vault.secrets(id),
  updated_at timestamptz not null default now()
);
alter table eworks_private.gib_accounts enable row level security;
revoke all on eworks_private.gib_accounts from public, anon, authenticated;

-- Yalnızca Edge Function'daki sunucu anahtarı çağırabilir.
-- Tarayıcı kullanıcı UUID'sini göndermez; doğrulanmış JWT'den Edge belirler.
create or replace function public.eworks_gib_credential_service(
  p_owner uuid, p_action text, p_credentials jsonb default null
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_secret uuid; v_updated timestamptz; v_value text;
begin
  if p_owner is null or not exists(select 1 from auth.users where id=p_owner) then
    raise exception 'Invalid owner';
  end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('eworks-gib:'||p_owner::text,0));
  select secret_id,updated_at into v_secret,v_updated
    from eworks_private.gib_accounts where user_id=p_owner;
  if p_action='status' then
    return pg_catalog.jsonb_build_object('configured',v_secret is not null,'updatedAt',v_updated);
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
      v_secret:=vault.create_secret(v_value,'eworks-gib-'||p_owner::text,'Eworks GIB account');
      insert into eworks_private.gib_accounts(user_id,secret_id) values(p_owner,v_secret);
    else
      perform vault.update_secret(v_secret,v_value);
      update eworks_private.gib_accounts set updated_at=now() where user_id=p_owner;
    end if;
    return pg_catalog.jsonb_build_object('configured',true);
  elsif p_action='robot' then
    if v_secret is null then raise exception 'GIB account is not configured'; end if;
    select decrypted_secret into v_value from vault.decrypted_secrets where id=v_secret;
    if v_value is null then raise exception 'GIB credential is unavailable'; end if;
    return (v_value::jsonb)||pg_catalog.jsonb_build_object('ownerId',p_owner);
  else
    raise exception 'Unknown operation';
  end if;
end;
$$;
revoke all on function public.eworks_gib_credential_service(uuid,text,jsonb) from public, anon, authenticated;
grant execute on function public.eworks_gib_credential_service(uuid,text,jsonb) to service_role;
commit;
