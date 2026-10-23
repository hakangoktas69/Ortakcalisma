# Eworks durumu ve açık riskler

> İşe başlamadan bu dosyaya bak. Son güncelleme: 2026-10-23, kaynak `51e2cd1` (kaynak tarihi 21.10.2026).

## Durum

| Alan | Durum |
|---|---|
| Sözleşme listesi okuma | Canlı doğrulandı 17.10.2026 (274 sözleşme, commit sürüm 7) |
| e-Beyanname listesi, beyanname/tahakkuk PDF, MUHSGK SGK belgeleri, çalışan sayısı | Kodlu, sentetik testli; canlı tam tarama iddia edilmez |
| e-Defter, e-Tebligat | Menü/adaptör var, tamamlanmadı |
| Otomatik giriş (OCR + tıklama) | 21.10 sürümünde açık (`8cb6397`); belgeler hâlâ "kullanıcı girer" diyor |
| Test | `VALIDATION.md` 48 testlik küme yeşil; tam küme değil; CI yok |
| Kaynak | Depo = paylaşım kopyası; canlı portal ve 2. yöntem (`02-developer-servis-denemesi`) depoda değil |
| Belgeler | `hkazaz/eworks/` 23.10.2026'da oluşturuldu |

## Açık riskler (önem sırası)

Kritik: **G-01** otomatik GİB girişi · **G-02** geçerli JWT + Origin'siz istek → GİB şifresi düz metin.
Yüksek: **G-03** Vault okuma denetimi yok · **G-04** `jobs/` altında süresiz kişisel veri · **G-05** KVKK yurt dışı aktarım/saklama/imha · **G-06** CSP yok + `innerHTML`.
Orta: G-07 köprü GET uçları · G-08 hot-reload/`runtime` · G-09 bağımlılık sabitleme · G-10 yetim Vault sırları · G-11 yönetici erişimi · G-12 MFA yok.
Ayrıntı ve kanıt: `../04-eksikler-ve-riskler/02-guvenlik-riskleri.md`.

Mimari: M-01 tek dosya ön yüz · M-02 tek JSONB · M-03 büro/rol yok · M-05 migration yok · M-09 GİB DOM bağımlılığı · M-10 test/CI · M-15 kaynak gerçeği · M-17 Mükellef Takip örtüşmesi. Ayrıntı: `../04-eksikler-ve-riskler/01-mimari-yapisal-eksikler.md`.

## Hedef mimari (2026-10-23)

Kararlar D1–D10 (Hakan): Next.js ön yüz + BFF · SaaS, kullanıcıda kurulum yok · localhost köprüsü/masaüstü ajanı yok, robot backend'de paralel · Supabase on-prem · tarayıcı JS'inde token/adres/anahtar yok · **CAPTCHA otomatik** (GİB, SGK, diğer; gece işleri tam otomatik) · **kurum istekleri aralıklı, toplam istek/dk parametresi** · **ofis → müşavir → mükellef; müşavir + her mükellefin kendi kurum hesabı** (örn. 1.505 hesap/ofis) · tutumlu kaynak, büyük veri parçalı · **dağıtım Compose veya Kubernetes (seçimli)**.

Ana çıkarım: robot kapasitesini CPU değil **istek bütçesi** belirler (`gece kapasitesi = R × P × S / q`); HTTP hibrit (tarayıcı yalnız giriş), artımlı senkron ve çıkış IP sayısı kapasite kaldıraçlarıdır. Kuyruk RabbitMQ (durum Postgres `jobs` + outbox), hız sınırlayıcı Redis GCRA, `institution_accounts` + Vault, `wrong_password` hesap bir daha denenmez.

24.10 kararları D11–D15: pilot **30 istek/dk**, hatasızken kademeli artış, **bağlantı hatasında hız yarıya + devre kesici** · **mükellefler portala girer** (`mukellef` rolü, `firm_users`) · **tüm SGK ekranları** (Kontrol Listesi, e-Bildirge, İşe Giriş Çıkış, e-Rapor, İş Kazası) ilk sürümde, **müşavir talebiyle toplu çekim**, SGK resmî web servisleri öncelikli · **çıkış IP'si sabit ve kayıtlı; hesap başına sahte/dönüşümlü IP uygulanmaz** (TCP'de spoofing çalışmaz, kurum denetimini atlatma amaçlı — K-22) · **PDF saklama 7 gün** (`document_retention_days`), parçalı günlük temizlik + yönetici toplu temizlik.

24.10 kararları D16–D19: **mükellef ↔ tek müşavir** (aktif VKN sistem genelinde tekil, devir akışı) · **hiyerarşik sayfa/işlem yetkisi** (yetki ağacı + rol şablonu + kişiye özel izin/engel; personel kapsamını müşavir/ofis admini verir; yetki yükseltme yasak; müşavir izniyle personel müşavirin kurum hesabıyla iş başlatır) · **mükellef onayıyla** müşavir mükellef kurum bilgilerini kullanır, **mükellef müşavir bilgilerini asla kullanamaz** (DB tetikleyici + BFF + işçi) · **web servis birincil, robot yedek** (`integrations.primary_transport`, `fallback_policy` vars. `manual`, ortak hız bütçesi).

24.10 kararları D20–D22: kaynak kod **DDD** (11 bounded context + Python ACL; aynı ad domain paketi/BFF/ön yüz/DB şeması/testte) · README haritası + `docs/baglamlar/` + üretilen özellik durumu · **TDD**; özellik ağacı = yetki ağacı, testler `@F:anahtar` etiketli, durum CI'da hesaplanır, **tamamlanmayan modül/sayfa/buton kırmızı** (D30 ile tüm ortamlarda herkese görünür; uygulanmamış işlem 501).

Belgeler: `../05-hedef-mimari/01…06` (genel bakış, kurum entegrasyonları, kapasite, dağıtım, yetki ve hesap modeli, kaynak kod yapısı DDD/TDD). Geçiş ≈ 5,5 ay.

24.10 kararları D23–D30: iş verisi **10 yıl** (devirde eski ofisteki veri dahil; itiraz süresi parametre, vars. 7 gün) · **sharding baştan** (kontrol düzlemi + `org_id` kiracı shard'ları, 16 mantıksal / 2 fiziksel; shard içinde zamana göre bölümleme) · başlangıç hızı **60 istek/dk** · ölçek **500 ofis**, hesap başına 60 istek/dk, gece **20:00–09:00** · **satış portalı** yeni yapıda, ofis/müşavir/mükellef hesapları satıştan, mükellef onayı satış sözleşmesiyle · **tüm depo klasörleri `eski/` altına, yeni yapı kökte** (plan, taşıma ayrı adımda) · **veri taşıma yok**, `mert/eworks` revize edilen proje · **kırmızı özellikler herkese her ortamda görünür**. Belgeler: `../05-hedef-mimari/07…08`.

24.10 kararı D31: yeni yapıda Claude/Codex bağlam ve hafızası git'te, **karşılıklı otomatik senkron** (`tools/ajan/senkron.mjs`; `AGENTS.md` blokları, `MEMORY.md` dizini ve beceriler tek kaynaktan üretilir; tetik git kancaları + Claude kancaları + Codex `AGENTS.md`; `bitir` iki tarafı da kurar). Belge: `../05-hedef-mimari/09-yapay-zeka-ajan-baglami.md`.

**Açık konular (2026-10-24; ekip hafızasında da: `mukellef-takip/docs/ai/memory/eworks-acik-konular.md`):** (1) hız/ölçek tutarlılığı: 60 istek/dk toplam başlangıç 500 ofis (≈752.500 hesap) için yetmez; "60/dk" kapsamları ve web servis limitleri netleşmeli (5.3 §1a) · (2) Mükellef Takip'in `eski/` sonrası durumu (geliştirme mi arşiv mi; CI) · (3) depo taşıma tarihi ve ekip duyurusu · (4) shard başlangıç donanımı. Süren iş: GİB/SGK web servis envanteri analizi (Hakan).

## Plan (öneri, onay bekliyor)

- **Faz A (≈1 hafta):** `auto_login=False`, belge-kod eşitleme, `jobs/` temizliği, `runtime` + hot-reload kapatma, bölge belgeleme, kaynak gerçeği.
- **Faz B (2–4 hafta):** Edge iş bileti, Vault erişim denetimi, MFA, CSP, migrations, CI, kilitli bağımlılıklar, JSON Schema.
- **Faz C:** robotu Mükellef Takip `data-intake`'e veri kaynağı yap, Eworks portalını dondur.

Ayrıntı: `../04-eksikler-ve-riskler/03-iyilestirme-plani.md`. Bir madde kapanınca bu dosyayı ve ilgili tabloyu aynı değişiklikte güncelle.
