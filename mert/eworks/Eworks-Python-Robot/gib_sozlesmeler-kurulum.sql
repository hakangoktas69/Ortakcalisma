-- Mevcut portal durum tablosundan ayrı sözleşme deposu. SQL Editor'da çalıştırılır.
begin;
create table if not exists public.gib_sozlesmeler (
    musavir_id uuid not null references auth.users(id) on delete cascade,
    mukellef_vkn_tckn text not null check (mukellef_vkn_tckn ~ '^[0-9]{10,11}$'),
    mukellef_unvan text not null,
    sozlesme_no text not null,
    durum text not null,
    veriler jsonb not null check (jsonb_typeof(veriler) = 'object'),
    primary key (musavir_id, mukellef_vkn_tckn, sozlesme_no)
);
alter table public.gib_sozlesmeler enable row level security;
revoke all on public.gib_sozlesmeler from anon, authenticated;
grant select, insert, update on public.gib_sozlesmeler to authenticated;
create policy gib_sozlesmeler_read on public.gib_sozlesmeler
    for select to authenticated using ((select auth.uid()) = musavir_id);
create policy gib_sozlesmeler_insert on public.gib_sozlesmeler
    for insert to authenticated with check ((select auth.uid()) = musavir_id);
create policy gib_sozlesmeler_update on public.gib_sozlesmeler
    for update to authenticated using ((select auth.uid()) = musavir_id)
    with check ((select auth.uid()) = musavir_id);
commit;
