-- sync: takvim kaynakları işi (takvim.kaynaklar). Kamuya açık GİB vergi takvimi (listAll) ve Nager.Date tatilleri okunur;
-- kurum hesabı ve sır kullanılmaz, bu yüzden account_id boştur. Kullanıcı ister (requested_by = kendisi) ya da işçi GİB verisi
-- eksik yıl için kendiliğinden ister (sistem bağlamı, requested_by boş). Diğer iş türleri yine hesapsız ve isteyensiz açılamaz.
-- Mevcut veride: tüm satırların hesabı ve isteyeni dolu; yeni kısıt onları karşılar. Geri dönüş: yeni migration (önce takvim
-- işleri silinir, sonra not null geri konur).

alter table sync.jobs alter column account_id drop not null;
alter table sync.jobs alter column requested_by drop not null;
alter table sync.jobs drop constraint if exists jobs_kind_check;
alter table sync.jobs add constraint jobs_kind_check check (kind in ('gib.sozlesmeler', 'gib.beyannameler', 'gib.muhsgk', 'takvim.kaynaklar'));
alter table sync.jobs drop constraint if exists jobs_hesap_check;
alter table sync.jobs add constraint jobs_hesap_check check (kind = 'takvim.kaynaklar' or (account_id is not null and requested_by is not null));

-- İşçi (sistem bağlamı) yalnız takvim işini kendiliğinden açabilir
drop policy if exists sistem_ekler on sync.jobs;
create policy sistem_ekler on sync.jobs for insert to authenticated with check (app.is_system(org_id) and kind = 'takvim.kaynaklar' and status = 'queued');
