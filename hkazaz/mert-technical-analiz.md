# Eworks — Teknik Analiz (Technical Analysis)

> Kaynak: `mert/eworks` (commit `bb9aaa4`, 19.10.2026). Kaynak kod, SQL, Edge Function ve dokümanlar incelenerek hazırlanmıştır.

## 1. Mimari genel bakış

```
 Müşavirin bilgisayarı (127.0.0.1)                         Supabase (bulut)
┌──────────────────────────────────────────┐        ┌────────────────────────────┐
│ Tarayıcı: eworks-tasarim.html (SPA)       │──REST──▶ Auth (e-posta/şifre, JWT)  │
│  - Supabase Auth, oturum bellekte         │──RPC───▶ eworks_commit (sürümlü)    │
│  - Tüm durum tek JSONB belgesi            │        │ eworks_state / _events (RLS)│
└───────────────┬──────────────────────────┘        │                            │
                │ X-Eworks-Token + owner UUID        │ Edge Function: gib-account │
                ▼                                    │   └─ service_role ile       │
┌──────────────────────────────────────────┐        │      eworks_gib_credential_ │
│ yerel-sunucu.py (ThreadingHTTPServer:8765)│        │      service → Vault        │
│  - statik dosya + iş kuyruğu (tek iş)     │        └──────────────▲─────────────┘
│  - verify_owner → Supabase /auth/v1/user  │                       │ action=robot
└───────────────┬──────────────────────────┘                       │ (Origin'siz)
                │ subprocess (stdin: access token)                  │
                ▼                                                   │
┌──────────────────────────────────────────┐                       │
│ portal_worker.py (Playwright, görünür     │───────────────────────┘
│ Chrome) → dijital.gib.gov.tr              │
│  navigation_adapter → gib_automation      │
│  sonuç: JSON stdout (eworks.gib.contracts.v1)
└──────────────────────────────────────────┘
```

Önemli tasarım kararı: **Robot Supabase'e yazmaz.** Sonuç yerel sunucuya döner, portal kendi kullanıcı oturumuyla `eworks_commit` RPC'si üzerinden kaydeder. Böylece robota yazma yetkisi verilmiyor.

## 2. Teknoloji yığını

| Katman | Teknoloji |
|---|---|
| Frontend | Tek dosya HTML + vanilla JavaScript (framework yok, build yok). Supabase'e doğrudan `fetch` ile REST/RPC çağrısı (supabase-js kullanılmıyor) |
| Yerel köprü | Python 3.13 standart kütüphane `http.server` (ThreadingHTTPServer), xlrd |
| Robot | Playwright (async, Chromium), requests, supabase-py, python-dotenv |
| OCR (pasif) | pytesseract, OpenCV, numpy, Pillow |
| Backend | Supabase: PostgreSQL + RLS, Auth, Vault (`supabase_vault`), Edge Function (Deno, TypeScript) |
| Test | Python `unittest`, Node (`.cjs` / `.mjs`) betikleri |
| Başlatma | `Baslat.ps1` (Windows, sabit Python313 yolu) |

## 3. Kod büyüklüğü

| Dosya / alan | Satır | Not |
|---|---|---|
| `eworks-tasarim.html` | 1.072 | ~208 KB, satırlar çok uzun; tüm UI, durum ve Supabase istemcisi tek dosyada |
| `gib_automation.py` | 277 | Tablo okuma, doğrulama (`validate_contracts`), OCR, CLI giriş akışı |
| `portal_worker.py` | 239 | Portal tetiklemeli tek iş: Chrome → liste → JSON |
| `main_orchestrator.py` | 200 | Bağımsız CLI varyantı |
| `yerel-sunucu.py` | 182 | Yerel HTTP köprüsü ve iş yönetimi |
| `navigation_adapter.py` | 170 | Menü/kart bulma, belirsizlik tespiti, sıcak yeniden yükleme |
| `logger_service.py` | 89 | `sistem_loglari` tablosuna RLS'li log (CLI varyantı) |
| `cloud_credentials.py` | 63 | Oturum doğrulama, Vault'tan şifre çekme, GİB formunu doldurma |
| SQL (5 dosya) + Edge Function | ~290 | |
| Testler (10 dosya) | ~800 | |

## 4. Veri modeli

### 4.1 Portal durumu (`supabase-kurulum.sql`) — kurulu
- `eworks_state(user_id PK, payload jsonb, revision bigint)`: **Kullanıcı başına tek JSONB belgesi.** `firms`, `tasks` ve diğer tüm modül verileri bunun içinde.
- `eworks_events(user_id, operation_id UNIQUE, action, revision)`: işlem günlüğü ve idempotency kaydı.
- **Yazma yalnızca `eworks_commit` RPC'si üzerinden** (`security definer`, `search_path=''`):
  - `auth.uid()` zorunlu, istemci sahip kimliği göndermiyor.
  - `pg_advisory_xact_lock` ile kullanıcı bazında seri hale getirme.
  - Aynı `operation_id` tekrar gelirse önceki sürüm döner (idempotent).
  - `p_expected_revision` ≠ mevcut sürüm → `40001` çakışma hatası (optimistic concurrency).
  - Payload ≤ 5 MB, `firms` ve `tasks` dizi olmalı.
- `eworks_security_check()`: RLS ve yetkilerin gevşetilmediğini çalışma anında doğrulayan, kapalı başarısız olan (fail-closed) kontrol. İyi bir uygulama.
- `anon` ve `authenticated` için tablo yazma yetkisi kaldırılmış, sadece `select` var.

### 4.2 GİB kimlik bilgileri (`supabase-gib-vault.sql`) — kurulu
- `eworks_private` şeması, `public`/`anon`/`authenticated` erişimi kapalı.
- `gib_accounts(user_id, secret_id → vault.secrets)`.
- `eworks_gib_credential_service(p_owner, p_action, p_credentials)`: `status` / `save` / `robot`. **Yalnızca `service_role` çalıştırabilir.** Kullanıcı UUID'si Edge Function'da doğrulanmış JWT'den gelir.

### 4.3 Firma bazlı hesaplar (`supabase-firma-gib-vault.sql`) — taslak, kurulmadı
- `firm_gib_accounts(user_id, firm_id)`. Firma varlığı `eworks_state.payload->'firms'` içinde JSON araması ile kontrol ediliyor.

### 4.4 CLI varyantı tabloları — hazırlandı, canlıda çalıştırılmadı
- `gib_sozlesmeler` (PK: müşavir + VKN/TCKN + sözleşme no, RLS) ve `sistem_loglari` (RLS'li log). Portal bu tabloları okumuyor.

## 5. Bileşen bazında teknik notlar

### 5.1 Edge Function `gib-account`
- `verify_jwt = false`, onun yerine kod içinde `admin.auth.getUser(token)` ile doğrulama yapılıyor (dokümanda gerekçesi var).
- Origin allowlist (`EWORKS_ALLOWED_ORIGINS`, varsayılan localhost:8765). Joker yok.
- İstek gövdesi akış halinde okunuyor, 8 KB sınırı var. Hata mesajları genel tutulmuş, içerik loglanmıyor.
- **`robot` işlemi (şifreyi düz metin döndürür), `Origin` başlığı olan isteklere kapalı.** Bu, tarayıcıdaki bir XSS'in şifreyi okumasını engelliyor. Ancak geçerli kullanıcı JWT'sine sahip herhangi bir tarayıcı dışı istemci şifreyi alabilir. Bu bir kimlik doğrulama sınırı değil, savunma katmanı (kullanıcının kendi şifresi olduğu için kabul edilebilir).

### 5.2 Yerel köprü `yerel-sunucu.py`
- Yalnızca `127.0.0.1:8765`'e bağlanıyor. `Host` başlığı kontrolü DNS rebinding'e karşı koruma sağlıyor.
- POST'larda `Host` + `Origin` + süreç başına rastgele `TOKEN` (`secrets.token_urlsafe(32)`) kontrol ediliyor.
- `/api/gib/update`: Supabase'e `verify_owner` ile JWT ve UUID eşleşmesi soruluyor.
- **Tek eşzamanlı iş.** İş durumu bellekte (`JOBS`), dosya tabanlı IPC kullanılıyor (`jobs/<id>/status.json`, `ready.json`, `cancel`, `focus-<pid>.request`). Yazmalar atomik (`.tmp` → `replace`).
- Robot alt süreç olarak çalışıyor, 930 sn zaman aşımı var. Erişim token'ı stdin ile aktarılıyor, diske yazılmıyor.
- Sonuç iki kez doğrulanıyor (robotta ve sunucuda `validate_contracts`): şema, sayı, sahip ve iptal kontrolü.
- Statik dosyalar allowlist ile servis ediliyor. `nosniff`, `no-referrer`, `no-store` başlıkları ekleniyor.
- Gözlem: `TOKEN`, kimlik doğrulamasız `GET /api/connection` ile dönüyor. CORS başlığı olmadığı için başka bir origin bunu okuyamaz, ama koruma tamamen same-origin politikasına dayanıyor. Doküman bunun "internet için kimlik doğrulama olmadığını" zaten belirtiyor.

### 5.3 Robot (`portal_worker.py`, `navigation_adapter.py`, `gib_automation.py`)
- `trusted(url)`: yalnızca `https://*.gib.gov.tr`. Şifre yalnızca `https://dijital.gib.gov.tr/portal/login` sayfasında, etiketine göre tek kullanıcı ve tek şifre alanı bulunursa dolduruluyor. Sonra `credentials.clear()` çağrılıyor.
- Menü gezintisi metin tabanlı: görünürlük, imleç ve ekran dışı karusel kopyalarını eleme. **Birden fazla aday bulunursa tıklanmıyor (`AmbiguousTarget`)** ve kullanıcı bekleniyor.
- `navigation_adapter` dosya değişince çalışma sırasında yeniden yükleniyor (geliştirici kolaylığı; üretimde kapatılmalı).
- Toplam doğrulama: alt bilgideki `1 - N listeleniyor. Toplam: N` metni ile tablo satır sayısı karşılaştırılıyor. Birden fazla farklı toplam görülürse işlem duruyor.
- Tablo, liste başlığı ve 9 bilinen sütun başlığı eşleşirse tanınıyor. Kimlik biçimi, tekrar ve sayı hatasında yazma yapılmıyor.
- 15 dakikalık iş süresi var. Hata durumunda Chrome açık bırakılıyor, kullanıcının düzeltmesi bekleniyor.
- Tarayıcı profili, çerez ve CAPTCHA görseli kalıcı olarak saklanmıyor. Her seferinde yeni bağlam açılıyor.

### 5.4 OCR (pasif)
- OpenCV ön işleme (OTSU, çizgi maskeleme, morfoloji), en fazla 4 deneme, Tesseract çağrısı başına 3 sn sınır. Portal akışında **devre dışı.** Gerçek CAPTCHA başarımı ölçülmedi.
- Not: CAPTCHA'nın otomatik çözülmesi GİB kullanım koşulları açısından riskli. Devre dışı tutulması doğru karar.

### 5.5 Portal (`eworks-tasarim.html`)
- Supabase Auth: `token?grant_type=password` ve `refresh_token`. **Oturum yalnızca bellekte** (localStorage/sessionStorage kullanılmıyor), sayfa yenilenince yeniden giriş gerekiyor.
- Kaydedilemeyen değişiklikler kuyrukta tutuluyor. Hata panelinde "yeniden dene" ve "JSON yedeği indir" seçenekleri var. Kuyruk doluyken çıkış engelleniyor.
- Dinamik HTML'de `safe()` kaçış fonksiyonu kullanılıyor (6 `innerHTML` kullanımı var, gözden geçirilmeli).
- `demo-cleanup.js`: demo kayıtları geri alınabilir şekilde ayırıyor (fiziksel silme yok).
- Menüde ~40 alt sayfa var (e-Beyanname, SGK ×5, Faturalar ×4, Ödeme ×7, Raporlar ×4 …). **Bunların çoğunun arkasında veri kaynağı yok.**

## 6. Test durumu

| Dosya | Kapsam |
|---|---|
| `test_robot.py` (6) | Sözleşme doğrulama, tablo okuma |
| `test_navigation.py` (5) | Menü bulma, karusel/ekran dışı eleme, Tümünü Göster varyantları (sentetik HTML) |
| `test_ocr.py` (5) | OCR ön işleme ve sentetik görsel |
| `test_cloud_credentials.py` (3), `test_login_confirmation.py` (3) | Vault çekme, giriş formu doldurma kuralları |
| `test_portal_bridge.py` (3), `test_portal_ui.py` (2), `test_demo_cleanup_ui.py` (1) | Yerel köprü ve UI |
| `test_edge_function.mjs` (~12), `test-demo-cleanup.cjs` (~14) | Edge Function davranışı, demo temizliği |

- Toplam ~54 test/kontrol. Dokümana göre son tam çalıştırmada 19 Python testi geçmiş.
- Bazı testler canlı servis veya ek bağımlılık (Tesseract, Chromium) gerektiriyor. CI yok.
- SQL için otomatik test yok (`eworks_security_check` çalışma anında kontrol sağlıyor).

## 7. Güvenlik değerlendirmesi

**İyi uygulamalar:**
- RLS ile birlikte yalnızca RPC üzerinden yazma, `security definer` + boş `search_path`.
- Fail-closed güvenlik kontrolü.
- `service_role` anahtarı istemcide değil, yalnızca Edge Function'da.
- Vault ile ayrı ve özel şemada sır saklama.
- Robota yazma yetkisi verilmemesi.
- Erişim token'ının diske yazılmaması.
- Host ve Origin kontrolleri, URL allowlist'i.
- Veri doğrulamasının iki katmanda yapılması.
- `.gitignore` ile müşteri verisi, oturum ve ekran görüntüsü dosyalarının dışlanması.

**Bulgular ve öneriler:**

| # | Bulgu | Öneri |
|---|---|---|
| 1 | `Supabase-Kullanim.md` içinde **gerçek Supabase proje kimliği** (`opzzdzxinhevwvfmnhfo`) geçiyor. README ise canlı adreslerin örnek değerle değiştirildiğini söylüyor | Doküman temizlenmeli. Publishable key paylaşılmadığı için risk düşük, ama tutarsızlık giderilmeli |
| 2 | Vault, proje yöneticisine karşı korumalı değil. GİB şifresi `robot` çağrısıyla düz metin dönüyor | Müşteri onayı ve KVKK metni. Erişim denetim kaydı (her `robot` çağrısı loglansın). Uzun vadede istemci tarafı şifreleme değerlendirilebilir |
| 3 | `robot` işleminin tarayıcıdan ayrımı yalnızca `Origin` başlığına dayanıyor | Robot için ayrı, kısa ömürlü ve tek amaçlı bir token ya da imzalı iş kimliği kullanılması |
| 4 | Yerel köprünün `TOKEN`'ı kimlik doğrulamasız GET ile dönüyor. Sahip UUID'si gizli bir bilgi değil | Yerel pilot için kabul edilebilir. Yayına çıkmadan önce gerçek bir kimlik doğrulama katmanı eklenmeli |
| 5 | `/gib-sozlesmeler.json` (eski Excel aktarımı, müşteri verisi) yerel sunucuda kimlik doğrulamasız servis ediliyor | Eski akış kaldırılmalı ya da token arkasına alınmalı |
| 6 | Çalışma sırasında modül yeniden yükleme (`importlib.reload`) | Üretim yapısında kapatılmalı |
| 7 | 208 KB tek HTML ve satır içi script, CSP yok | Modüllere bölme, CSP ve `innerHTML` kullanımlarının denetimi |

## 8. Ölçeklenebilirlik ve mimari borç

- **Tek JSONB belge modeli:** Her kayıtta tüm durum yeniden yazılıyor (en fazla 5 MB). Sorgulama, raporlama ve kısmi güncelleme yapılamıyor. Bir büroda çok kullanıcı ya da paylaşım modeli yok (`user_id` = tek müşavir). Firma, sözleşme ve görev için ilişkisel tablolara geçilmeli (CLI'daki `gib_sozlesmeler` bu yönde bir başlangıç).
- **Yerel robot:** Tek iş, tek makine, görünür Chrome. Bulutta çalışması için uzaktan tarayıcı (ör. noVNC veya CDP akışı) ve CAPTCHA'nın kullanıcıya iletilmesi gerekiyor.
- **Ekran metnine bağlılık:** GİB arayüzündeki her değişiklik adaptör güncellemesi gerektirir. Seçiciler ve başlıklar yapılandırma dosyasına taşınmış (`gib-selectors.example.json`), bu iyi bir başlangıç.
- **Kurulum:** `Baslat.ps1` sabit Python yolu bekliyor. Bağımlılıklar ağır (Playwright, Chromium, OpenCV, Tesseract). Paketleme (PyInstaller veya kurulum programı) gerekli.
- **İki paralel akış:** Portal worker ve CLI orchestrator. Kod tekrarını azaltmak için CLI'ın worker'a indirgenmesi düşünülmeli.

## 9. `hakan/mukellef-takip` ile teknik entegrasyon önerisi

| Konu | Öneri |
|---|---|
| Veri sözleşmesi | `eworks.gib.contracts.v1` JSON şeması korunarak Mükellef Takip'e `POST /api/import/...` benzeri bir uç eklenebilir. `Company` kayıtları VKN/TCKN ile eşleştirilir |
| Kaynak etiketi | Mükellef Takip'te `DeclarationSource` / firma kaynağına `ROBOT` değeri eklenmesi |
| Kimlik | Robot, Mükellef Takip'in kapsamı sınırlı eklenti anahtarı modelini (`ApiToken`, `gib:import`) kullanabilir. Bu, Supabase JWT köprüsünün yerini alır |
| Şifre | Mükellef Takip `VaultService` (AES-256-GCM + denetim kaydı) ile saklanabilir ya da hiç saklanmayıp kullanıcının her seferinde girmesi istenebilir |
| Yeniden kullanılacak parçalar | `navigation_adapter`, `footer_counts`, `validate_contracts`, `trusted()` URL kontrolü ve yerel köprünün iş yaşam döngüsü |

## 10. Teknik öneriler (öncelik sırasıyla)

1. Dokümandaki gerçek proje kimliğinin temizlenmesi ve eski `/gib-sozlesmeler.json` akışının kaldırılması.
2. Vault'tan şifre doldurma adımının canlı kabul testinin tamamlanması ve her `robot` çağrısının denetim kaydına yazılması.
3. CI kurulması: canlı servis gerektirmeyen `unittest` ve Node testlerinin ayrılıp her push'ta çalıştırılması.
4. Veri modelinin ilişkisel tablolara taşınması ve büro (çok kullanıcı) kavramının eklenmesi.
5. Portal HTML'inin modüllere ayrılması ve CSP eklenmesi. Prototip ekranlarının "yakında" olarak işaretlenmesi.
6. Robotun paketlenmesi ve kurulumunun tek adıma indirilmesi.
7. Ortak ürün kararına göre robotun Mükellef Takip'e veri kaynağı olarak bağlanması.
