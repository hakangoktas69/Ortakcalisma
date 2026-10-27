-- workspace: kişisel hatırlatmalar (Mert 26.10 takvimindeki "Yeni Hatırlatma"). Yalnız sahibi görür ve değiştirir; firmaya
-- bağlıysa firma kullanıcının kapsamında olmalı. Uyarı uygulama içidir (e-posta/SMS yok). Yeni tablo: mevcut veriye etkisi yok.

create table if not exists workspace.reminders (
  org_id uuid not null references organization.organizations(id),
  id uuid not null default gen_random_uuid(),
  user_id uuid not null,
  title text not null check (length(title) between 1 and 250),
  remind_on date not null,
  remind_time time,
  category text not null check (category in ('toplanti', 'not', 'dogum_gunu', 'tebligat', 'beyanname', 'defter', 'sgk', 'e_imza', 'mali_muhur', 'diger')),
  firm_id uuid,
  note text check (length(note) <= 3000),
  remind_days int not null default 0 check (remind_days in (0, 1, 3, 7)),
  source_entry text check (length(source_entry) <= 80),
  done boolean not null default false,
  created_at timestamptz not null default now(),
  primary key (org_id, id),
  foreign key (org_id, user_id) references identity_access.memberships(org_id, user_id),
  foreign key (org_id, firm_id) references portfolio.firms(org_id, id)
);
create index if not exists reminders_sahip on workspace.reminders(org_id, user_id, remind_on);

alter table workspace.reminders enable row level security;
drop policy if exists sahibi on workspace.reminders;
create policy sahibi on workspace.reminders for all to authenticated
  using (app.is_staff_of(org_id) and user_id = app.uid())
  with check (app.is_staff_of(org_id) and user_id = app.uid() and (firm_id is null or app.can_see_firm(org_id, firm_id)));
grant select, insert, delete, update (done) on workspace.reminders to authenticated;
