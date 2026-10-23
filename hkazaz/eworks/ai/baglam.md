# Eworks bağlamı

> Kısa özet. Ayrıntı: `../02-mimari/` (sistem mimarisi, bileşen ilişkileri, veri modeli, güvenlik mimarisi). Kod kökü `E1/` = `mert/eworks/entegrasyon-1-tarayici/`.

## Bileşenler

| Bileşen | Yol | Teknoloji | Rol |
|---|---|---|---|
| Portal | `E1/Eworks-Portal/eworks-tasarim.html` (+ `institution-review.js`, `demo-cleanup.js`, `declaration-pdf-viewer.mjs`) | Vanilla JS, build yok, supabase-js yok | Ekranlar, iş kuralları, Supabase REST/RPC, kayıt kuyruğu |
| Köprü | `E1/Eworks-Portal/yerel-sunucu.py` | Python stdlib HTTP, 127.0.0.1:8765 | Statik sunum, tek iş başlatma/izleme, sonuç doğrulama |
| Robot | `E1/Eworks-Python-Robot/` | Playwright (Chrome), requests, pypdf, OCR | GİB okuma, PDF indirme/Storage yükleme |
| OCR | `.ocr-venv` + `local_ocr_worker.py` | ddddocr / Tesseract | CAPTCHA önerisi |
| Supabase | `supabase-*.sql`, `supabase/functions/gib-account/index.ts` | Postgres RLS, Vault, Storage, Deno Edge | Kalıcılık, şifre kasası, PDF |

## Akış (sözleşme güncelleme)

Portal `GET api/connection` (token) → `POST api/gib/update` (Host+Origin+`X-Eworks-Token`+`X-Eworks-Owner`+JWT; köprü `verify_owner`) → köprü `portal_worker.py jobs/<id>` alt sürecini JWT'yi **stdin**'den vererek başlatır → robot Edge `action=robot` (Origin'siz) ile Vault'tan GİB kimliğini alır → Chrome'da giriş (OCR + `auto_login=True`) → menü → tablo → altbilgi sayısı doğrulama → stdout `eworks.gib.contracts.v1` → köprü şema doğrulaması → portal `GET api/jobs/<id>/result` → VKN/TCKN ile birleştirme → `rpc/eworks_commit`.

Beyanname senkronu: `POST api/declarations/sync` (≤64 KB kapsam) → `declaration_sync` → okuyucu + PDF (`declaration_documents`: doğrula, SHA-256, Storage `eworks-declarations/<uid>/<kimlik>/<kayıtId>/<tür>-<sha>.pdf`, geri oku) → `eworks.declarations.sync.v1` → portal commit.

Köprü ↔ robot IPC: `jobs/<id>/` içinde `request.json`, `status.json`, `ready.json`, `worker.json`, `cancel`, `focus-<pid>.request/.ack`, checkpoint'ler. Tek iş; zaman aşımı 930 sn (sözleşme) / 7230 sn (beyanname).

## Veri modeli

- `public.eworks_state(user_id PK, payload jsonb ≤5MB, revision, updated_at)` — kullanıcı başına **tek belge**. Anahtarlar: `firms[] tasks[] notes[] institutionReviews[] institutionScopes{} overrides{} uploaded[] ledgers{} alertsRead[] declarationLastSync sgkCoverage[]`.
- `public.eworks_events(user_id, operation_id UNIQUE, action, revision)` — commit günlüğü.
- RPC: `eworks_commit(payload, expected_revision, operation_id, action)` (idempotent, `40001` çakışma), `eworks_security_check()` (RLS kapısı).
- `eworks_private.gib_accounts`, `firm_gib_accounts` → `vault.secrets`; yalnız `service_role` RPC'leri `eworks_gib_credential_service`, `eworks_firm_gib_credential_service` (`status|save|robot`).
- Storage `eworks-declarations`: özel, PDF, 20 MB, SELECT/INSERT ilk klasör = `auth.uid()`, UPDATE/DELETE yok.
- Eski CLI: `gib_sozlesmeler`, `sistem_loglari` (portal kullanmaz).

## Yapılandırma

Supabase URL + publishable key üç yerde elle: `eworks-tasarim.html` (~1297), `cloud_credentials.py` (5-6), robot `.env` (eski CLI). Edge gizli değişkenleri: `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `EWORKS_ALLOWED_ORIGINS`. `verify_jwt=false` (kontrol kod içinde).

## Mükellef Takip ile ilişki

Aynı iş alanı; Mükellef Takip şifre saklamaz ve otomatik GİB girişi yapmaz. Önerilen yol: robot çıktısını Mükellef Takip `data-intake`'e `ApiToken gib:import` ile içe aktarmak, Eworks portalını dondurmak.
