# 5.3 Kaynak verimliliği ve kapasite

> Önce: [5.2 Kurum entegrasyon robotu](02-kurum-entegrasyon-robotu.md) · Sonra: [5.4 Dağıtım](04-dagitim-compose-kubernetes.md)
> Kararlar: D7 (dakikalık istek parametresi), D8 (ofis başına binlerce hesap), D9 (tutumlu kaynak kullanımı, büyük veri küçük parçalarla).

## 1. Kapasite hesabı — robot

Robotun kapasitesini istek bütçesi belirler:

```
Gece kapasitesi (iş)      = R × P × S / q
Gerekli paralel bağlam    ≈ (R / 60) × t × 2
Ofis başına gece süresi   = hesap_sayısı × q / (R × S)   (dakika)
```

| Sembol | Anlamı | Örnek |
|---|---|---|
| R | Etkin toplam hız (istek/dk). **60'tan başlar** (D25), hatasız oldukça `global_rpm_max`'a kadar artar | 60 → 120 |
| P | Gece penceresi (dk) | 780 (20:00–09:00, D26) |
| S | Gece bütçesinin toplu işlere payı | 0,9 |
| q | Bir hesap-işinin ortalama kurum isteği | 3 (web servis) / 30 (robot, HTTP hibrit) / 80 (robot, yalnız tarayıcı) |
| t | Bir istek + sayfa işleme süresi (sn) | 2 |

Örnek hesap, tek ofis (doğrulanmamış varsayımlarla, pilotta ölçülecek):

| Senaryo | R | q | Gece kapasitesi (hesap-işi) | 1.505 hesaplı ofis kaç dakika |
|---|---|---|---|---|
| Başlangıç, robot, yalnız tarayıcı | 60 | 80 | 527 | 2.230 dk (≈ 3 gece) |
| Başlangıç, robot, HTTP hibrit | 60 | 30 | 1.404 | 836 dk (≈ 1 gece) |
| Başlangıç, **web servis** | 60 | 3 | 14.040 | 84 dk |
| Hedef hız, robot, HTTP hibrit | 120 | 30 | 2.808 | 418 dk |

Çıkarımlar:

1. **HTTP hibrit yöntem** (tarayıcı yalnız giriş için) kapasiteyi yaklaşık 2–3 kat artırır. En önemli verimlilik kaldıracı budur.
2. **Artımlı senkron** gereklidir. Her gece her hesabın her şeyi taranmaz; yalnız yeni dönem ve son günü yaklaşanlar taranır. Tam tarama haftalık veya aylık, parçalı yapılır. SGK toplu çekimi müşavir talebiyle yapılır (D13), gece bütçesini tüketmez.
3. Kapasitenin tavanı **kurumun kabul ettiği toplam hızdır**, IP sayısı değil (D14). 20 ofis × 1.505 hesap ≈ 30.000 hesap için gece başına tam tarama gerçekçi değildir. Artımlı plan, öncelik, **resmî web servisleri** ve kurumdan izin gerekir.
4. **Web servis yolu (D19) kapasiteyi en çok artıran kaldıraçtır.** Giriş ve CAPTCHA isteği yoktur, bir veri kümesi genellikle 1–3 servis çağrısıyla gelir (q ≈ 2–5). Aynı R ile robot yoluna göre 5–15 kat fazla hesap-işi yapılır. Servis işçisi tarayıcı taşımaz (≈ 0,25 vCPU / 256 MB). Bu formüller servis yoluna da uygulanır, ama kurumun servis için ayrı hız sınırı varsa `institution_rpm_max[k]` o sınırla ayarlanır.
5. **Paralel bağlam ihtiyacı küçüktür:** R=120, t=2 sn → ≈ 8 bağlam. Yüzlerce tarayıcı açmak yerine birkaç işçi yeterlidir. Robot katmanı küçük kalır, bellek tasarrufu sağlanır.

## 1a. 500 ofis ölçeğinde hesap (D26)

Varsayım: 500 ofis × 1.505 hesap ≈ **752.500 kurum hesabı**. Gece penceresi 780 dk, toplu iş payı %90 → 702 dk.

| q (istek/hesap-işi) | Tüm hesapları **bir gecede** taramak için gereken toplam hız | 60 istek/dk ile bir gecede taranabilen | 60 istek/dk ile tam tarama süresi |
|---|---|---|---|
| 3 (web servis) | ≈ 3.216 istek/dk (≈ 54 istek/sn) | 14.040 hesap | ≈ 54 gece |
| 10 | ≈ 10.719 istek/dk | 4.212 hesap | ≈ 179 gece |
| 30 (robot, hibrit) | ≈ 32.158 istek/dk | 1.404 hesap | ≈ 536 gece |

Çıkarımlar:

1. **60 istek/dk'lık toplam başlangıç hızı 500 ofis ölçeğine yetmez.** Bu hız tek bir kurum oturumu/IP'si için temkinli bir başlangıç olarak anlamlıdır. Asıl ölçeği belirleyecek olan, web servis analizinden çıkacak **kurum servis limitleridir**. Bu limitler toplam hız mı, hesap/kimlik başına mı, kurum başına mı? Servis limitleri kimlik bilgisi (hesap) başına ise kapasite hesap sayısıyla birlikte büyür. Bu durumda darboğaz `account_rpm_max` (60/dk) ve işçi sayısı olur, toplam hız olmaz.
2. **Artımlı senkron zorunludur.** Her gece yalnız değişmesi beklenen hesaplar taranır: son günü yaklaşan dönemler, yeni bildirge dönemi, müşavirin talep ettiği SGK yenilemesi. Gece başına hesapların %10'u taranırsa web serviste gereken hız ≈ 320 istek/dk olur.
3. Robot yolu bu ölçekte yalnız **yedek** olabilir (D19). Tam tarama için robota güvenilemez.
4. Rakamlar, web servis analizi bitince kurum ve yol bazında yeniden hesaplanır. Planlayıcı "kapasite yetersiz" alarmını bu hesaba göre verir ([5.2 §5.2](02-kurum-entegrasyon-robotu.md#52-gece-planlayıcı)).

Paralellik notu: Hesap başına 60 istek/dk (D26) tek bir hesabın işini hızlandırır (web serviste ≥ 1 sn/istek). Toplam iş hacmini toplam hız ve kurum limitleri belirler.

## 2. Kapasite — web, veri, mesajlaşma

| Bileşen | Küçük profil (≤ 5 ofis) | Orta (≤ 30 ofis) | Büyük (30+ ofis) | Ölçekleme tetiği |
|---|---|---|---|---|
| Next.js BFF | 1 × 1 vCPU / 1 GB | 2 × 1 vCPU / 1,5 GB | 3+ (HPA) | p95 > 300 ms, CPU > %70 |
| Servis işçisi (birincil) | 1 × 0,25 vCPU / 256 MB | 2 × 0,5 vCPU / 384 MB | 2–6 (KEDA) | `svc.*` kuyruk beklemesi > 2 dk |
| Robot işçisi (yedek) | 1 × 1 vCPU / 1,5 GB (K=3) | 2–3 × 1 vCPU / 1,5 GB | Bütçeye göre (bkz. §1) | kapı bekleme düşük ve kuyruk büyüyorsa |
| OCR | 1 × 0,5 vCPU / 512 MB | 2 × 0,5 vCPU | 2–4 | p95 > 1 sn |
| Ayrıştırma işçisi | 1 × 1 vCPU / 768 MB | 2 × 1 vCPU / 768 MB | 2–6 (KEDA) | `parse` kuyruğu > 5 dk |
| PostgreSQL | 4 vCPU / 16 GB | 8 vCPU / 32 GB + replika | 16 vCPU / 64 GB + replika | p95 sorgu > 100 ms |
| Supavisor | 1 | 2 | 2–3 | bekleyen istemci > 0 |
| GoTrue / PostgREST / Storage / Kong | 1'er, 0,25–0,5 vCPU / 256–512 MB | 2'şer | 2–3'er | — |
| RabbitMQ | 1 düğüm, 512 MB | 3 düğüm (quorum), 1 GB | 3 düğüm, 2 GB | kuyruk bellek alarmı |
| Redis | 256 MB | 1 GB (+ replika) | 2 GB (Sentinel) | `used_memory` > %70 |
| MinIO | 1 düğüm, 500 GB | 4 düğüm (silinme kodlaması) | 4+ düğüm | doluluk %70 |
| Toplam (yaklaşık) | **1 sunucu, 8 vCPU / 32 GB** | **3–4 VM** | **K8s kümesi** | — |

Kabul ölçütleri:
- Web (k6): 300 eşzamanlı kullanıcı, p95 sayfa < 500 ms, hata < %0,1.
- Robot (sahte kurum sunucusu): yapılandırılmış hız ±%5 içinde, 1 saat koşu. İşçi öldürme testinde iş kaybı yok. RSS sınırın altında.
- Ayrıştırma: 1 GB'lık ham sonuç (çok sayıda PDF) işlenirken işçi belleği < 768 MB.

## 3. Servis bazında tutumluluk kuralları (D9)

### Next.js (web + BFF)
- **Sunucu tarafı sayfalama zorunludur:** keyset (`where (org_id, id) > …`), sayfa boyutu ≤ 100. 1.500 firmanın tamamı tarayıcıya gönderilmez. Arama ve filtre sunucuda yapılır.
- Liste ekranları yalnız gereken sütunları ister (`select=id,title,status…`). Toplam sayılar özet tablolardan gelir, her istekte `count(*)` yapılmaz.
- CSV/Excel dışa aktarımı **akışla** yapılır (satır satır), belleğe toplanmaz. Büyük dışa aktarımlar iş olarak kuyruğa girer, bitince indirme bağlantısı gösterilir.
- İstemci paketi küçük tutulur: sunucu bileşenleri varsayılandır, ağır tablo kütüphaneleri dinamik yüklenir.
- `NODE_OPTIONS=--max-old-space-size` konteyner belleğinin ≈ %75'i olarak ayarlanır.
- SSE bağlantısı kullanıcı başına 1'dir. Olaylar küçük tutulur (kimlik + durum), ayrıntı gerektiğinde istenir.

### BFF → Postgres
- N+1 sorgu yasaktır. Birleşik okumalar için SQL görünümü/RPC kullanılır.
- Pano/özet sayıları için ofis bazlı **özet tablolar** tutulur, ayrıştırma işçisi bunları artımlı günceller (tam yeniden hesaplama yok).

### Robot işçisi
- Bkz. [5.2 §8](02-kurum-entegrasyon-robotu.md#8-robot-işçisi-kaynak-kuralları-özet).
- PDF'ler indirilirken belleğe alınmaz, **doğrudan MinIO'ya akışla** yazılır (çok parçalı yükleme). SHA-256 akış sırasında hesaplanır.
- Bekleyen iş tarayıcı bağlamı tutmaz (uzun beklemede kuyruğa geri dönülür).

### Ayrıştırma işçisi
- Tek seferde tek dosya ve tek parti işlenir. `prefetch=1`.
- PDF sayfa sayfa okunur (`pypdf` sayfa yineleyicisi). Büyük tablolar satır akışıyla okunur.
- Yazma 500 satırlık partilerle (`insert … on conflict … do update`) ve kısa işlemlerle yapılır.

### PostgreSQL
- `statement_timeout` (web rolü 5 sn, işçi rolü 60 sn), `idle_in_transaction_session_timeout` 30 sn, `work_mem` düşük (16–32 MB) tutulur. Büyük sıralamalar için indeks kullanılır.
- `declarations`, `job_steps`, `audit_log`, `documents` **aylık/yıllık bölümlenir**. Eski bölümler ayrılıp arşivlenebilir.
- Her indeks `org_id` ile başlar. Kısmi indeksler kullanılır (`where status='active'`).
- Autovacuum yoğun yazılan tablolarda sıkılaştırılır.
- Bağlantılar Supavisor (transaction mode) üzerinden kurulur. Rol başına bağlantı kotası tutulur (web, robot, parser).

### RabbitMQ
- Mesajlar **yalnız kimlik** taşır (< 1 KB). Veri Postgres ve MinIO'dadır.
- Quorum kuyruk (disk tabanlı), `x-max-length` + taşma → DLQ, mesaj TTL.
- `vm_memory_high_watermark` 0,4, disk alarmı açık.

### Redis
- **Her anahtarda TTL** bulunur: oturum (idle 30 dk, mutlak 12 saat), kurum oturum çerezi (15–20 dk), semafor (iş süresi + pay).
- `maxmemory` + `volatile-ttl` politikası. Hız sınırlayıcı anahtarları küçüktür (kurum/IP/hesap başına 1 anahtar).

### MinIO
- Saklama: PDF ve ham sonuç varsayılan **7 gün** (`document_retention_days`, `raw_result_retention_days`). Silme, planlayıcının parçalı temizlik işiyle yapılır ([5.2 §9](02-kurum-entegrasyon-robotu.md#9-belge-pdf-saklama-ve-toplu-temizlik-d15)). Bu nedenle MinIO boyutu ≈ bir haftalık PDF hacmi + pay olarak planlanır.
- Çok parçalı yükleme, akışlı okuma.

### Büyük veri işlemleri (genel kural)
- Toplu geçmiş tarama, yeniden ayrıştırma, shard'lar arası ofis taşıma, arşivleme ve dışa aktarım **parçalı iş** olarak yürür. Parça = ofis × hesap × ay. Her parça checkpoint'lidir. Eşzamanlı parça sayısı parametreyle sınırlanır. Parçalar gündüz kullanıcı trafiğiyle yarışmayacak önceliktedir.
