-- Supabase SQL Editor'da proje sahibi olarak bir kez çalıştırın.
begin;
create table if not exists public.eworks_state (
  user_id uuid primary key references auth.users(id) on delete cascade,
  payload jsonb not null default '{}'::jsonb check (jsonb_typeof(payload)='object'),
  revision bigint not null default 0,
  updated_at timestamptz not null default now()
);
create table if not exists public.eworks_events (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  operation_id uuid not null,
  action text not null,
  revision bigint not null,
  created_at timestamptz not null default now(),
  unique(user_id,operation_id)
);
alter table public.eworks_state enable row level security;
alter table public.eworks_events enable row level security;
drop policy if exists eworks_state_owner on public.eworks_state;
create policy eworks_state_owner on public.eworks_state for all to authenticated
 using ((select auth.uid())=user_id) with check ((select auth.uid())=user_id);
drop policy if exists eworks_events_read on public.eworks_events;
create policy eworks_events_read on public.eworks_events for select to authenticated using ((select auth.uid())=user_id);
revoke all on public.eworks_state,public.eworks_events from anon,authenticated;
grant select on public.eworks_state,public.eworks_events to authenticated;
-- Writes only through atomic commit RPC; no client-supplied owner ID.
create or replace function public.eworks_commit(p_payload jsonb,p_expected_revision bigint,p_operation_id uuid,p_action text)
returns bigint language plpgsql security definer set search_path = '' as $$
declare v_uid uuid := auth.uid(); v_revision bigint; v_prior bigint;
begin
 if v_uid is null then raise exception 'Authentication required' using errcode='28000';end if;
 if jsonb_typeof(p_payload) is distinct from 'object' or octet_length(p_payload::text)>5242880
 or jsonb_typeof(p_payload->'firms') is distinct from 'array'
 or jsonb_typeof(p_payload->'tasks') is distinct from 'array' then raise exception 'Invalid state';end if;
 if p_operation_id is null or p_expected_revision is null or p_action is null or length(p_action)>120 then raise exception 'Invalid operation';end if;
 perform pg_advisory_xact_lock(hashtextextended(v_uid::text,0));
 select revision into v_prior from public.eworks_events where user_id=v_uid and operation_id=p_operation_id;
 if found then return v_prior;end if;
 select revision into v_revision from public.eworks_state where user_id=v_uid for update;
 v_revision:=coalesce(v_revision,0);
 if v_revision<>p_expected_revision then raise exception 'Revision conflict; reload before saving' using errcode='40001';end if;
 v_revision:=v_revision+1;
 insert into public.eworks_state(user_id,payload,revision) values(v_uid,p_payload,v_revision)
 on conflict(user_id) do update set payload=excluded.payload,revision=excluded.revision,updated_at=now();
 insert into public.eworks_events(user_id,operation_id,action,revision) values(v_uid,p_operation_id,p_action,v_revision);
 return v_revision;
end $$;
revoke all on function public.eworks_commit(jsonb,bigint,uuid,text) from public,anon;
grant execute on function public.eworks_commit(jsonb,bigint,uuid,text) to authenticated;
-- Readiness check fails closed if policies or table privileges were loosened.
create or replace function public.eworks_security_check() returns boolean
language sql security definer set search_path='' stable as $$
 select auth.uid() is not null
 and (select relrowsecurity from pg_class where oid='public.eworks_state'::regclass)
 and (select relrowsecurity from pg_class where oid='public.eworks_events'::regclass)
 and not has_table_privilege('anon','public.eworks_state','SELECT')
 and not has_table_privilege('anon','public.eworks_state','INSERT')
 and not has_table_privilege('anon','public.eworks_events','SELECT')
 and (select count(*)=1 and bool_and(qual like '%auth.uid()%user_id%' and with_check like '%auth.uid()%user_id%') from pg_policies where schemaname='public' and tablename='eworks_state')
 and (select count(*)=1 and bool_and(qual like '%auth.uid()%user_id%') from pg_policies where schemaname='public' and tablename='eworks_events');
$$;
revoke all on function public.eworks_security_check() from public,anon;
grant execute on function public.eworks_security_check() to authenticated;
commit;
