-- Supabase SQL Editor'da proje sahibi çalıştırır. Mevcut portal SQL'inden ayrıdır.
begin;
create table if not exists public.sistem_loglari (
    id bigint generated always as identity primary key,
    musavir_id uuid not null references auth.users(id) on delete cascade,
    islem_adi text not null check (char_length(islem_adi) between 1 and 120),
    durum text not null check (char_length(durum) between 1 and 40),
    mesaj text not null check (char_length(mesaj) <= 2000),
    created_at timestamptz not null default now()
);
alter table public.sistem_loglari enable row level security;
revoke all on public.sistem_loglari from anon, authenticated;
grant select, insert on public.sistem_loglari to authenticated;
grant usage on sequence public.sistem_loglari_id_seq to authenticated;
create policy sistem_loglari_owner_read on public.sistem_loglari
    for select to authenticated using ((select auth.uid()) = musavir_id);
create policy sistem_loglari_owner_insert on public.sistem_loglari
    for insert to authenticated with check ((select auth.uid()) = musavir_id);
commit;
