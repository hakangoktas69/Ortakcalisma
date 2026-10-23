# Eworks — Claude proje belleği

Mali müşavirin GİB e-Beyanname sözleşmelerini, beyanname listelerini, beyanname/tahakkuk PDF'lerini ve MUHSGK içindeki SGK belgelerini, **müşavirin kendi Windows bilgisayarında** görünür Chrome ile çalışan bir Python/Playwright robotuyla okuyup Supabase üzerindeki tek sayfalık portala aktaran **yerel pilot**. GİB şifresi (Vault) ve TCKN/VKN işlendiği için **KVKK ve GİB kuralları** temel kısıttır.

- **Kod:** `mert/eworks/entegrasyon-1-tarayici/` (sahibi Mert; değiştirmeden önce kullanıcıya sor). Belgelerde `E1/` kısaltması.
- **Bu klasör (`hkazaz/eworks/`):** dokümantasyon + bu bağlam. Kod değişikliğinde ilgili belge **aynı değişiklikte** güncellenir.
- Bu dosya ileride `mert/eworks/CLAUDE.md` olarak taşınabilir; taşınırsa `ai/` klasörü de birlikte taşınır (içe aktarımlar görelidir).

## Ayrıntılı bağlam

- @ai/baglam.md — bileşenler, akışlar, veri modeli, arayüz sözleşmeleri (kısa)
- @ai/kurallar.md — pazarlıksız kurallar, kod üslubu, test, SQL kuralları
- @ai/durum-ve-riskler.md — şu anki durum, açık riskler, plan (işe başlamadan bak)
- İnsan belgeleri: `README.md` (seviye ve rol bazlı okuma yolları). Yeni robot işi / SQL / Edge değişikliği → `03-gelistirici-rehberi/03-tarifler.md`; bilinen tuzaklar → `03-gelistirici-rehberi/05-tuzaklar.md`.
- Mükellef Takip ile karşılaştırma ve entegrasyon önerisi: `../mert-technical-analiz.md` §9, `04-eksikler-ve-riskler/03-iyilestirme-plani.md` Faz C.

## Ekip hafızası

Depo genelinde otomatik hafıza `mukellef-takip/docs/ai/memory/`'ye yönlenir (kök `CLAUDE.md`). Eworks'e ait kalıcı bilgi önce **bu klasördeki belgelere** yazılır: kural → `ai/kurallar.md`, durum/risk → `ai/durum-ve-riskler.md` + `04-eksikler-ve-riskler/`, karar → `02-mimari/05-mimari-kararlar.md` (`K-NN`), tuzak → `03-gelistirici-rehberi/05-tuzaklar.md`. Ekip hafızasına yalnız kodda/belgede görünmeyen öğrenilmiş bilgi yazılır; kayıt adı `eworks-` ile başlar ve gövdenin ilk satırı `Klasör: mert/eworks` olur. Kişisel veri, gerçek mükellef/müşavir bilgisi, Supabase URL/anahtarı hafızaya ve belgelere yazılmaz. Sonra `cd mukellef-takip && npm run memory:check`.

## Yapı

```
mert/eworks/
  README.md, VALIDATION.md                 kapsam, kurulum, doğrulanmış test kümesi
  entegrasyon-1-tarayici/
    SOURCE-MANIFEST.json                   70 kaynak dosyanın SHA-256 özeti
    Eworks-Portal/                         eworks-tasarim.html (tek dosya SPA), yerel-sunucu.py (köprü :8765),
                                           supabase-*.sql, supabase/functions/gib-account (Edge), vendor/pdfjs
    Eworks-Python-Robot/                   portal_worker.py (iş girişi), GİB adaptörleri, test_*.py, *.sql (eski CLI)
hkazaz/eworks/                             bu dokümantasyon
hkazaz/docker/mert/                        yerel Supabase + Docker deneme yığını (README: hkazaz/docker/README.md)
```

## Çalıştırma

```powershell
cd mert\eworks\entegrasyon-1-tarayici
python -m pip install -r Eworks-Portal/requirements.txt
python Eworks-Portal/yerel-sunucu.py          # http://127.0.0.1:8765/eworks-tasarim.html
cd Eworks-Python-Robot
python -m unittest test_declaration_adapter test_declaration_reader test_declaration_sync test_declaration_documents test_muhsgk_sgk_reader test_sgk_employee_count test_portal_bridge test_declaration_pdf_viewer   # 48 test, yeşil olmalı
python -m unittest                             # tümü (bazı arşiv testleri kırmızı olabilir)
node test_edge_function.mjs
```

Yerel Supabase: `hkazaz/docker/mert/baslat.ps1` (portlar 55321–55329). Robot Docker'da çalışmaz (görünür Chrome + CAPTCHA).

## Pazarlıksız kurallar (özet; ayrıntı ve gerekçe `ai/kurallar.md`)

1. Service-role anahtarı yalnızca Edge Function ortamında; tarayıcıya, robota, depoya girmez.
2. GİB şifresi yalnız Vault'ta; tarayıcıya dönmez, diske/loga yazılmaz; robot bellekte kullanıp temizler.
3. Robot veritabanına yazmaz; kayıt portalın kullanıcı oturumuyla `eworks_commit` üzerinden yapılır (PDF Storage yüklemesi tek istisna).
4. Fail-closed: sayı/başlık/şema uyuşmazlığında sonuç kaydedilmez.
5. Yeni yetki yüzeyi (köprü ucu, RPC, Edge eylemi) = kimlik + sahiplik + boyut kontrolü + "reddedilmeli" testi.
6. Otomatik GİB girişini genişletme; yeni kodda `auto_login=False` (açık risk G-01, karar bekliyor).
7. Kişisel veri (VKN/TCKN, unvan, SGK listesi) log'a, hata mesajına, test fikstürüne, belgeye girmez; diske yazılan her kişisel veri için silme yolu olur.
8. Supabase URL/anahtarı, `.env`, `jobs/`, PDF, XLS commit edilmez.

## Dil ve üslup

Arayüz metinleri, yorumlar, belgeler, commit mesajları **Türkçe**; tanımlayıcılar İngilizce. Mevcut dosyanın üslubuna uy. Doğrulanmamış canlı GİB davranışını doğrulanmış gibi yazma; "sentetik testli" / "canlı doğrulandı (tarih)" ayrımını koru.
