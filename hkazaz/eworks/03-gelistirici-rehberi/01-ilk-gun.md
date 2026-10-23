# 3.1 İlk gün — kurulum ve çalıştırma

> Önce: [Genel bakış](../00-genel-bakis.md) · Sonra: [Kod haritası](02-kod-haritasi.md)

## Ön koşullar

| Araç | Neden | Not |
|---|---|---|
| Windows 10/11 | Başlatıcı, OCR venv yolu, `CREATE_NO_WINDOW` Windows'a özgü | Linux/Mac'te köprü ve testler çoğunlukla çalışır, OCR yolu değişir |
| Python 3.11+ | Köprü + robot | `Baslat.ps1` `%LOCALAPPDATA%\Programs\Python\Python313\python.exe` bekler |
| Google Chrome | Playwright `channel='chrome'` | Chromium değil, kurulu Chrome |
| Tesseract (isteğe bağlı) | Eski OCR yolu | Yol kodda sabit (`gib_automation.py:196`, `captcha_assist.py:65`) |
| Node.js | `test_edge_function.mjs`, portal `test-*.cjs` | `stripTypeScriptTypes` için güncel Node (≥22.6) |
| Supabase projesi | Auth, DB, Vault, Storage, Edge | Kendi test projeniz veya yerel Supabase (Docker) |

## 1. Kodu bulun

```powershell
cd <depo>\mert\eworks\entegrasyon-1-tarayici
```

> `mert/eworks` Mert'in klasörüdür. Kod değişikliğinden önce sahibine sorun (kök `CLAUDE.md` kuralı). Denemeleri kendi kopyanızda yapın.

## 2. Python bağımlılıkları

```powershell
python -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install -r Eworks-Portal/requirements.txt   # robot gereksinimlerini de içerir
python -m playwright install chrome                        # gerekirse
```

OCR (ayrı ortam, ddddocr'ın bağımlılıkları ana ortamla çakışmasın diye):

```powershell
cd Eworks-Python-Robot
python -m venv .ocr-venv
.\.ocr-venv\Scripts\python.exe -m pip install -r requirements-ocr.txt
cd ..
```

## 3. Supabase'i hazırlayın

Seçenek A — **Yerel (önerilen, gerçek veri yok):** [../../docker/README.md](../../docker/README.md) içindeki `hkazaz/docker/mert/baslat.ps1` SQL'leri ve Edge Function'ı kopyalayıp `npx supabase start` ile 55321–55329 portlarında yerel Supabase kurar ve bir demo kullanıcı oluşturur.

Seçenek B — **Kendi bulut test projeniz:** SQL Editor'de sırayla:

1. `Eworks-Portal/supabase-kurulum.sql`
2. `Eworks-Portal/supabase-gib-vault.sql`
3. `Eworks-Portal/supabase-firma-gib-vault.sql`
4. `Eworks-Portal/supabase-beyanname-belgeleri.sql`
5. (yalnız eski CLI) `Eworks-Python-Robot/gib_sozlesmeler-kurulum.sql`, `sistem_loglari-kurulum.sql`

Edge Function: `supabase functions deploy gib-account --no-verify-jwt`; gizli değişkenler `EWORKS_ALLOWED_ORIGINS=http://127.0.0.1:8765,http://localhost:8765`. Ayrıntı: `Eworks-Portal/Supabase-GIB-Hesap-Kurulum.md`.

## 4. Bağlantı sabitlerini girin (üç yer)

| Dosya | Sabit |
|---|---|
| `Eworks-Portal/eworks-tasarim.html` (~1297-1298) | `SUPABASE_URL`, `SUPABASE_KEY` (publishable) |
| `Eworks-Python-Robot/cloud_credentials.py` (5-6) | `URL`, `PUBLISHABLE_KEY` |
| `Eworks-Python-Robot/.env` (yalnız eski CLI) | `SUPABASE_URL`, `SUPABASE_KEY` |

**Bu değişiklikleri commit etmeyin.** Service-role anahtarını asla bu dosyalara koymayın.

## 5. Çalıştırın

```powershell
python Eworks-Portal/yerel-sunucu.py
# veya Eworks-Portal\Baslat.ps1 (gizli pencerede başlatır, tarayıcıyı açar)
```

Tarayıcı: `http://127.0.0.1:8765/eworks-tasarim.html` → Supabase kullanıcınızla girin.

## 6. Testleri koşun

```powershell
cd Eworks-Python-Robot
python -m unittest test_declaration_adapter test_declaration_reader test_declaration_sync test_declaration_documents test_muhsgk_sgk_reader test_sgk_employee_count test_portal_bridge test_declaration_pdf_viewer
```

Beklenen: 48 test geçer (`VALIDATION.md`). Tam `python -m unittest` bazı arşiv uyumsuzlukları nedeniyle kırmızı olabilir; ayrıntı [04-test.md](04-test.md).

## Gerçek GİB'e dokunmadan önce

- Gerçek GİB hesabı yalnızca hesabın sahibi müşavirin izniyle ve onun bilgisayarında kullanılır.
- Otomatik giriş (`auto_login=True`) şu an açık; GİB'e istenmeden giriş denemesi yapmamak için ne yaptığınızı bilin ([G-01](../04-eksikler-ve-riskler/02-guvenlik-riskleri.md#g-01)).
- `jobs/` klasöründe gerçek VKN/TCKN ve PDF birikir; iş bitince silin, asla paylaşmayın/commit etmeyin.

## İlk hafta önerisi

1. [02-bilesen-iliskileri.md](../02-mimari/02-bilesen-iliskileri.md) "Akış 2"yi kodda izleyin: `eworks-tasarim.html` içindeki `api/gib/update` çağrısı → `yerel-sunucu.py do_POST` → `portal_worker.run` → `eworks_commit`.
2. `test_portal_bridge.py` ve `test_declaration_sync.py`'yi okuyun; sentetik verinin nasıl kurulduğunu öğrenin.
3. [05-tuzaklar.md](05-tuzaklar.md)'yi okuyun.
