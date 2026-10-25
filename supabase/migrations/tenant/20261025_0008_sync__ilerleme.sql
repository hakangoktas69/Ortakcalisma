-- sync: uzun kurum işleri (beyanname taraması saatler sürebilir) takılı iş sayılmasın diye son ilerleme zamanı.
-- Takılı iş = son ilerlemesinden (yoksa başlangıcından) beri sessiz kalan çalışan iş.
alter table sync.jobs add column last_progress_at timestamptz;
