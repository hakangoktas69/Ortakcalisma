# 4.1 Mimari ve yapısal eksikler

> İlgili: [Güvenlik riskleri](02-guvenlik-riskleri.md), [İyileştirme planı](03-iyilestirme-plani.md), [Mimari kararlar](../02-mimari/05-mimari-kararlar.md)
> Kaynak: `51e2cd1`. **Durum** sütunu her kod güncellemesinde işlenir: Açık / Planlandı / Kapandı (commit).

Etki: **Y**üksek / **O**rta / **D**üşük — ürünleşme ve bakım açısından.

## Özet tablo

| # | Eksik | Etki | Durum |
|---|---|---|---|
| M-01 | Tek dosya, build'siz ön yüz (244 KB) | Y | Açık |
| M-02 | Kullanıcı başına tek JSONB belge veri modeli | Y | Açık |
| M-03 | Çok kiracılık / büro modeli yok | Y | Açık |
| M-04 | İki paralel kalıcılık yolu (portal vs eski CLI) | O | Açık |
| M-05 | Migration aracı, ortam ayrımı yok | Y | Açık |
| M-06 | Yapılandırma üç yerde, elle | O | Açık |
| M-07 | Yerel tek makine / tek iş mimarisi | Y | Açık (bilinçli) |
| M-08 | Gizli bağlar (dosya IPC, `sys.path`, JSON iç şekli) | O | Açık |
| M-09 | GİB DOM/metin bağımlılığı, izleme yok | Y | Açık |
| M-10 | Test ve CI eksikleri | Y | Açık |
| M-11 | Gözlemlenebilirlik yok | O | Açık |
| M-12 | Windows bağımlılığı | D | Açık |
| M-13 | Ölü ve yinelenen kod | D | Açık |
| M-14 | Belge-kod sapması | O | Açık |
| M-15 | Kaynak gerçeği belirsiz (paylaşım kopyası) | Y | Açık |
| M-16 | Veri yaşam döngüsü yok | O | Açık |
| M-17 | Mükellef Takip ile örtüşme | Y | Açık (strateji) |

## Ayrıntılar

### M-01 — Tek dosya, build'siz ön yüz
- **Gözlem:** `eworks-tasarim.html` 1374 satır / 244 KB; inline JS, bazı satırlar ~18 KB. Modül, lint, tip denetimi, birim test yok.
- **Etki:** Değişiklik riski yüksek, kod incelemesi pratikte imkânsız, XSS denetimi zor ([G-06](02-guvenlik-riskleri.md#g-06)).
- **Öneri:** Dondur; yeni özellik eklenmeyecekse yalnız bakım. Ürünleşecekse Mükellef Takip'in Next.js ön yüzüne taşı ya da en az ES modüllerine böl + ESLint + `// @ts-check`.

### M-02 — Tek JSONB belge
- **Gözlem:** Tüm firmalar, görevler, notlar tek satırda; her kayıtta tamamı yazılır; 5 MB tavan; danışma kilidiyle seri.
- **Etki:** Büyük bürolarda tavana çarpar; firma/belge bazında sorgu, indeks, rapor yok; satır düzeyinde yetki verilemez; kısmi bozulma tüm veriyi etkiler; KVKK'da tek kişinin verisini silmek belgeyi yeniden yazmak demek.
- **Öneri:** `firms`, `declarations`, `documents`, `tasks` ilişkisel tablolara; `payload` yalnız UI tercihleri için. Ya da doğrudan Mükellef Takip şemasına içe aktarım.

### M-03 — Çok kiracılık yok
- **Gözlem:** Kiracı = Supabase kullanıcısı (`user_id`). Büro, rol, personel kavramı yok.
- **Etki:** Büroda ikinci personel aynı veriyi göremez ya da müşavirin şifresini paylaşmak zorunda kalır (güvenlik ve KVKK sorunu).
- **Öneri:** `organization_id` + üyelik + rol; RLS `organization_id` üzerinden. (Mükellef Takip bunu zaten çözüyor.)

### M-04 — İki kalıcılık yolu
- **Gözlem:** Portal `eworks_state`; `main_orchestrator.py` `gib_sozlesmeler` + `sistem_loglari`.
- **Öneri:** Eski CLI'yı ve tablolarını kaldırın veya açıkça "arşiv" etiketleyin.

### M-05 — Migration yok
- **Gözlem:** 6 SQL betiği elle; sıra yalnızca belgede; sürüm tablosu yok; biri idempotent değil.
- **Öneri:** `supabase/migrations/` (Supabase CLI) — `hkazaz/docker/mert/supabase/migrations/` denemesi başlangıç olabilir; CI'da `supabase db reset` ile doğrulama.

### M-06 — Yapılandırma dağınık
- **Gözlem:** URL/publishable key HTML'de, `cloud_credentials.py`'de, `.env`'de; Tesseract yolu iki yerde; Python yolu `Baslat.ps1`'de sabit.
- **Öneri:** Tek `eworks.config.json` (gitignore) → köprü `/api/connection` ile portala sunar, robot aynı dosyayı okur.

### M-07 — Tek makine / tek iş
- **Gözlem:** `JOBS` bellek içi; tek iş; görünür Chrome; zamanlayıcı yok.
- **Etki:** 300+ mükellefli büroda beyanname senkronu saatler sürer, bilgisayar açık kalmalı. Sunucuya taşınamaz (CAPTCHA, GİB kuralları).
- **Öneri:** Bu kısıt büyük ölçüde iş alanından geliyor; hedef "sunucuya taşımak" değil, **kesintiye dayanıklılık** (checkpoint'ten devam — kısmen var) ve kapsamı parçalamak olmalı.

### M-08 — Gizli bağlar
- **Gözlem:** Köprü-robot dosya tabanlı IPC + stdout şeması; `sys.path` ile klasör içe alma; robot portal JSON iç şeklini okuyor; firma Vault SQL'i payload içinde arama yapıyor; Playwright nesnelerine özel öznitelik ekleme (`context._eworks_live_sync`).
- **Öneri:** Şemaları JSON Schema dosyası olarak `schemas/` altında yazın, iki tarafta da doğrulayın; robot paketini kurulabilir paket yapın (`pyproject.toml`).

### M-09 — GİB arayüz bağımlılığı
- **Gözlem:** Menü metinleri, tablo başlıkları, buton adları koda gömülü; `institution_discovery.py` 822 satır.
- **Etki:** GİB arayüz değişikliğinde robot durur (fail-closed olduğu için yanlış veri yazmaz — iyi).
- **Öneri:** Seçici/metin sözlüğünü tek dosyada toplayın; "duman testi" modunda haftalık elle doğrulama listesi; resmî kanal (GİB e-Beyanname entegratör servisleri) araştırması.

### M-10 — Test/CI
- **Gözlem:** 28 test dosyası; yalnızca 48 testlik küme yeşil olarak belgeli; CI yok; SQL/RLS testi yok; portal JS'i neredeyse testsiz.
- **Öneri:** GitHub Actions: `python -m unittest` (Chrome'suz küme) + `node` testleri + yerel Supabase'de SQL testleri (pgTAP). Bkz. [04-test.md](../03-gelistirici-rehberi/04-test.md).

### M-11 — Gözlemlenebilirlik
- **Gözlem:** Portal akışında `ProgressLogger.write_log` boş (`portal_worker.py:46-49`); hata yalnız `jobs/*.json`'da; merkezi log/metrik yok.
- **Öneri:** Maskeli yerel döner log dosyası (`logging.handlers.RotatingFileHandler` + `_safe_message`); iş özetini (süre, sayı, hata türü — kişisel veri yok) `eworks_events`'e ekleyin.

### M-12 — Windows bağımlılığı
`.ocr-venv/Scripts/python.exe`, `CREATE_NO_WINDOW`, PowerShell başlatıcı. Hedef kullanıcı Windows olduğu için düşük öncelik; `sys.platform` dallanması yeterli.

### M-13 — Ölü/yinelenen kod
- Ölü: `yerel-sunucu.py convert()` (18-39) ve ona bağlı `xlrd`; docstring "GIB'e baglanmaz" yanlış; eski seçici yolu `gib_automation.solve_captcha_and_login`/`scrape_contract_table`; `gib-selectors.example.json`.
- Yinelenen: `HEADERS`/`FIELDS` (3 yer), güvenilir köken yardımcıları (4 yer: `portal_worker.trusted`, `gib_automation._check_origin`, `navigation_adapter.trusted`, `institution_discovery.safe_origin`), iki Vault SQL fonksiyonu, sözleşme türü normalizasyonu (`declaration_sync.py:95`, `declaration_review.py:346`).

### M-14 — Belge-kod sapması
| Belge | Söylediği | Kod |
|---|---|---|
| `Kullanim.md:36-37`, `GIB-Canli-Akis.md:9`, `robot-config.json` | CAPTCHA'yı kullanıcı girer | `auto_login=True` (3 yer) |
| `Kullanim.md` | "SGK ve e-belge bilgileri bu robotla sorgulanmaz" | MUHSGK/SGK okuyucu var |
| `Supabase-Kullanim.md` | Dosya içerikleri depolanmaz | Storage kovası var |
| `yerel-sunucu.py` docstring | "GIB'e baglanmaz" | Robotu başlatır |

### M-15 — Kaynak gerçeği
- **Gözlem:** Depo kopyası "paylaşım kopyası"; canlı portal ve ikinci yöntem Mert'in yerelinde; sürüm etiketi yok; `SOURCE-MANIFEST.json` elle.
- **Öneri:** Mert'in çalışma kopyası depo olsun (dal + etiket); canlı değerler yalnız gitignore'lu yapılandırmada.

### M-16 — Veri yaşam döngüsü
`jobs/` temizlenmez; yetim Vault sırları; kaynaktan kalkan firmalar silinmez; Storage'da silme politikası yok; saklama süresi tanımsız. KVKK boyutu: [G-04](02-guvenlik-riskleri.md#g-04), [G-05](02-guvenlik-riskleri.md#g-05).

### M-17 — Mükellef Takip ile örtüşme
- **Gözlem:** Firma/mükellef, beyanname takibi, görev, SGK ekranları Mükellef Takip'te DDD modüler monolit olarak var; Eworks'ün özgün değeri GİB okuma robotudur.
- **Öneri:** Robotu "veri kaynağı" olarak Mükellef Takip'e bağlayın, Eworks portalını dondurun ([plan Faz C](03-iyilestirme-plani.md)). Eksik/çelişen ilke: otomatik giriş (bkz. G-01).
