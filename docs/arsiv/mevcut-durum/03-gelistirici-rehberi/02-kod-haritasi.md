# 3.2 Kod haritası

> Önce: [İlk gün](01-ilk-gun.md) · Sonra: [Tarifler](03-tarifler.md)

Kök: `E1/` = `mert/eworks/entegrasyon-1-tarayici/`. Satır sayıları `51e2cd1`.

## Eworks-Portal

| Dosya | Satır/Boyut | Görev |
|---|---|---|
| `eworks-tasarim.html` | 1374 satır / 244 KB | Tüm SPA: inline CSS + JS. Supabase istemcisi (`cloud`), oturum (~1306-1342), kayıt kuyruğu + `eworks_commit` (~1329), durum yükleme (~1343-1344), `safe()` kaçışlama (~626), köprü çağrıları, ekranlar (Firmalarım, Beyannameler, e-Bildirge, Ayarlar) |
| `institution-review.js` | | `EworksInstitutionReview`: kurum gözden geçirme sonuçlarını hazırlama/birleştirme |
| `demo-cleanup.js` | | Demo/simülasyon kayıtlarını ayırma ve geri alma |
| `declaration-pdf-viewer.mjs` | | PDF.js ile Storage'daki PDF'i görüntüleme |
| `yerel-sunucu.py` | ~220 | Köprü: `Handler.do_GET/do_POST`, `JOBS`, `run_job` (subprocess), sonuç doğrulama (74-93). `convert()` (18-39) **ölü kod** |
| `Baslat.ps1` | 10 | Sunucuyu gizli başlatır, tarayıcıyı açar |
| `robot-config.json` | | `enabled`, `mode: python`, not (güncel değil: otomatik giriş anlatılmıyor) |
| `supabase-*.sql` | | Şema, Vault, firma Vault, Storage — [veri modeli](../02-mimari/03-veri-modeli.md) |
| `supabase/functions/gib-account/index.ts` | ~60 | Edge Function: `status`/`save`/`robot` |
| `vendor/pdfjs/` | ~250 dosya | pdfjs-dist 6.4.299 |
| `test-demo-cleanup.cjs`, `test-institution-review.cjs` | | Node betik testleri |
| `*.md` | | Kullanıcı belgeleri (bir kısmı güncel değil, bkz. [M-14](../04-eksikler-ve-riskler/01-mimari-yapisal-eksikler.md)) |

## Eworks-Python-Robot

### Orkestrasyon
| Modül | Satır | Görev |
|---|---|---|
| `portal_worker.py` | 358 | Köprüden tek iş: Chrome aç → giriş → navigasyon → doğrulanmış liste → stdout JSON. `run()` 154, `main()` 331. Navigasyon modüllerini mtime değişince `reload` eder (57-64, 306-309) |
| `declaration_sync.py` | 276 | Salt okunur e-Beyanname tarama; kapsam doğrulama (48-69), checkpoint, uyarı dosyası |
| `main_orchestrator.py` | 200 | **Eski** bağımsız CLI (`--check`, `--config`); `gib_sozlesmeler` + `sistem_loglari` |

### Kimlik ve giriş
| Modül | Satır | Görev |
|---|---|---|
| `cloud_credentials.py` | 63 | Edge `robot` çağrısı, `verify_owner` (JWT → `/auth/v1/user`); URL/anahtar sabitleri (5-6) |
| `firm_credentials.py` | 31 | Firma bazlı Vault erişimi |
| `institution_login.py` | 124 | e-Beyan / e-Defter OAuth girişleri; `CaptchaAssist(auto_login=True)` (99) |
| `captcha_assist.py` | 138 | OCR önerisi + (isteğe bağlı) "Giriş Yap" tıklama (124-137); tek gönderim |
| `local_ocr.py` / `local_ocr_worker.py` | 28 / 49 | `.ocr-venv` alt süreci, stdin/stdout |

### GİB ekran adaptörleri (kırılgan katman)
| Modül | Satır | Görev |
|---|---|---|
| `navigation_adapter.py` | 170 | Menü yolu (İVD → e-Beyanname Yetki → Sözleşmeler); hot-reload |
| `institution_discovery.py` | 822 | Kurum menülerini gözleme, e-Beyanname sorgu ekranı; en büyük modül |
| `gib_automation.py` | 297 | Eski seçici tabanlı yol, sözleşme tablo kazıma, Tesseract OCR |
| `declaration_adapter.py` / `declaration_reader.py` | 62 / 100 | Beyanname liste alanları, sayfalı okuma |
| `declaration_document_adapter.py` | 168 | Satır içi PDF görüntüleme kontrollerinden indirme |
| `muhsgk_sgk_adapter.py` / `muhsgk_sgk_reader.py` | 45 / 137 | MUHSGK detayındaki SGK belgeleri |
| `notice_adapter.py` | 58 | e-Tebligat kolonları (içerik okunmaz) |

### Alan kuralları ve yardımcılar
| Modül | Satır | Görev |
|---|---|---|
| `declaration_documents.py` | 171 | PDF doğrulama, Storage'a yükleme, SHA-256 geri okuma; bilinen belgeleri `eworks_state`'ten okur |
| `sgk_employee_count.py` | 20 | Hizmet listesinden tekil kişi sayısı |
| `advisor_records.py` | 59 | Müşavir→mükellef aktarım kuralı (sözleşme + canlı yetki) |
| `institution_records.py` / `institution_scope.py` | 74 / 45 | Kurum liste adaptörleri ortak sözleşmesi, hesap kimliği |
| `declaration_review.py` | 87 | Elle konan kaynak dosyadan gözden geçirme |
| `source_record_id.py` | 26 | GİB opak kimliği ↔ güvenli dosya anahtarı |
| `local_files.py` | 16 | Atomik JSON yazımı (Windows kilitleri) |
| `logger_service.py` | 89 | Supabase log (eski CLI), maskeleme `_safe_message` (17-26) |

### Testler
`test_*.py` (28) — her modülün karşılığı; `test_portal_ui.py`, `test_portal_review_ui.py`, `test_firm_account_ui.py`, `test_demo_cleanup_ui.py` gerçek Chrome ister. `test_edge_function.mjs` Edge kodunu Node'da tip ayıklayıp çalıştırır.

## Adlandırma ve üslup

- Python: kısa, yoğun satırlar (çok sayıda `;` ile birleştirilmiş ifade), tip ipucu az, docstring Türkçe tek satır.
- Kullanıcıya dönen mesajlar Türkçe; tanımlayıcılar İngilizce.
- Şema adları `eworks.<alan>.<ad>.v<N>`.
- Yeni kod mevcut dosyanın üslubuna uymalı; ancak okunabilirlik için yeni modüllerde PEP 8'e yakın yazım tercih edilir (bkz. [03-tarifler.md](03-tarifler.md)).
