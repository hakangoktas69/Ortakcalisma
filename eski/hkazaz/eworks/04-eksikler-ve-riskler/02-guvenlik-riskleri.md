# 4.2 Güvenlik ve uyum riskleri

> İlgili: [Güvenlik mimarisi (mevcut kontroller)](../02-mimari/04-guvenlik-mimarisi.md), [İyileştirme planı](03-iyilestirme-plani.md)
> Kaynak: `51e2cd1`. Bu belge statik kod incelemesine dayanır; sızma testi yapılmamıştır. Satır numaraları `E1/` göreli.

**Önem:** Kritik / Yüksek / Orta / Düşük — olasılık × etki, GİB şifresi ve KVKK kişisel verisi en yüksek değerli varlık kabul edilerek.

## Özet tablo

| # | Risk | Önem | Durum |
|---|---|---|---|
| [G-01](#g-01) | Otomatik GİB girişi (Vault şifresi + OCR CAPTCHA + otomatik tıklama) | **Kritik** (uyum) | Bilinçli kabul (K-15, 2026-10-23) |
| [G-02](#g-02) | Geçerli JWT + Origin'siz istek = GİB şifresi düz metin | **Kritik** | Açık |
| [G-03](#g-03) | Vault okuma (şifre çözme) denetim kaydı yok | Yüksek | Açık |
| [G-04](#g-04) | Yerel diskte süresiz düz metin kişisel veri (`jobs/`) | Yüksek | Açık |
| [G-05](#g-05) | KVKK: yurt dışı aktarım, saklama/imha, aydınlatma belirsiz | Yüksek | Açık |
| [G-06](#g-06) | CSP yok + elle kaçışlama (`innerHTML`) | Yüksek | Açık |
| [G-07](#g-07) | Yerel köprü: token Origin'siz verilir, sonuç uç noktası JWT'siz | Orta | Açık |
| [G-08](#g-08) | Çalışma anında kod yeniden yükleme ve `runtime/` `sys.path` | Orta | Açık |
| [G-09](#g-09) | Bağımlılıklar sabitlenmemiş, kilit dosyası yok | Orta | Açık |
| [G-10](#g-10) | Kullanıcı silinince yetim Vault sırları | Orta | Açık |
| [G-11](#g-11) | Supabase yönetici erişimi tüm sırları çözebilir | Orta | Kabul edilmiş |
| [G-12](#g-12) | Eworks girişinde MFA yok | Orta | Açık |
| [G-13](#g-13) | Hata metinlerinin arayüze sızması / Edge'de hata maskeleme | Düşük | Açık |
| [G-14](#g-14) | `sistem_loglari` kullanıcı tarafından yazılabilir | Düşük | Açık |
| [G-15](#g-15) | Robot JWT'si uzun süre bellekte, yenilenmez | Düşük | Açık |
| [G-16](#g-16) | Demo kimlik bilgisi belgede; `verify_jwt=false` regresyon riski | Düşük | Açık |

Pozitif tespitler (korunmalı): service-role yalnız Edge'de; tarayıcı şifreyi geri okuyamaz; robot DB'ye yazmaz; RLS açılış kapısı; log maskeleme; depoda gerçek sır yok. Ayrıntı: [04-guvenlik-mimarisi.md](../02-mimari/04-guvenlik-mimarisi.md).

---

## G-01
**Otomatik GİB girişi** — Kritik (uyum/hukuk)

- **Kanıt:** `Eworks-Python-Robot/portal_worker.py:166`, `institution_login.py:99`, `declaration_sync.py:121` → `CaptchaAssist(auto_login=True)`; `captcha_assist.py:124-137` "Giriş Yap"a tıklar. Şifre Vault'tan alınıp doldurulur (`cloud_credentials.py`). Commit `8cb6397` "tek seferlik otomatik giriş ekle".
- **Çelişki:** `Kullanim.md:36-37`, `GIB-Canli-Akis.md:9`, `robot-config.json` "CAPTCHA'yı kullanıcı tamamlar" der. Mükellef Takip pazarlıksız kural #3: "otomatik GİB girişi yok".
- **Risk:** CAPTCHA'nın otomatik aşılması GİB kullanım koşullarına aykırı olabilir; hesabın kilitlenmesi/engellenmesi, müşavirin mesleki sorumluluğu. Kullanıcı gözetimi olmadan kurum hesabına giriş.
- **Öneri:** `auto_login=False` varsayılan; OCR yalnız öneri doldursun, tıklamayı kullanıcı yapsın (kod bu modu zaten destekliyor). Belgeleri gerçek davranışla eşitleyin. Otomatik giriş istenirse yazılı hukuki görüş + kullanıcıdan açık, kayıtlı onay.

## G-02
**Geçerli JWT + Origin'siz istek = GİB şifresi düz metin** — Kritik

- **Kanıt:** `Eworks-Portal/supabase/functions/gib-account/index.ts:45` — `robot` eylemi yalnızca `Origin` başlığı **varsa** reddedilir. `supabase-gib-vault.sql` `robot` dalı `decrypted_secret` döndürür.
- **Saldırı yolu:** Kullanıcının access token'ını ele geçiren herkes (XSS → [G-06](#g-06), yerel kötü amaçlı yazılım, log/proxy sızıntısı) `curl` ile Origin göndermeden `action=robot` çağırır ve GİB kullanıcı adı + şifresini alır. Origin kontrolü tarayıcıyı ayırır, saldırganı değil.
- **Öneri (artan güç sırasıyla):**
  1. `robot` eylemi için köprünün ürettiği, kısa ömürlü (ör. 2 dk), tek kullanımlık, sunucuda kayıtlı bir "iş bileti" iste (portal → Edge `issue_ticket`, robot → `robot{ticket}`).
  2. Her `robot` okumasını denetim kaydına yaz + kullanıcıya bildir ([G-03](#g-03)).
  3. Şifreyi hiç döndürmeyen tasarım: Mükellef Takip yaklaşımı (kullanıcı kendi girer, şifre saklanmaz) veya şifreyi yalnız kullanıcı cihazında işletim sistemi kasasında (Windows Credential Manager/DPAPI) tutmak.

## G-03
**Vault okuma denetim kaydı yok** — Yüksek

- **Kanıt:** `eworks_gib_credential_service` / `eworks_firm_gib_credential_service` `robot` dalında hiçbir tabloya yazmaz; `eworks_events` yalnız `eworks_commit` kayıtlarını tutar.
- **Risk:** Şifrenin ne zaman, hangi IP'den, kaç kez okunduğu bilinemez; ihlal fark edilemez, KVKK ihlal bildirimi (72 saat) için kanıt yok.
- **Öneri:** `eworks_private.credential_access_log(user_id, firm_id, action, at, request_ip_hash)`; Edge'den IP/UA özetiyle doldur; portalda "son erişimler" listesi.

## G-04
**Yerel diskte süresiz düz metin kişisel veri** — Yüksek (KVKK)

- **Kanıt:** `jobs/<id>/advisor-contract-evidence.json` (`portal_worker.py:251`), `declarations-sync-result.json` ve checkpoint'ler (`yerel-sunucu.py:79-81`, `declaration_sync.py:16-20`), `sgk-pdf-cache/` (`muhsgk_sgk_reader.py:116-122`), `declaration-query-warning.json` (`declaration_sync.py:229`). Silme yalnız odak işaret dosyaları için (`navigation_adapter.py:161,167`).
- **Risk:** Dizüstü kaybı/çalınması, yedekleme yazılımının buluta kopyalaması, paylaşılan bilgisayar → VKN/TCKN listeleri ve SGK hizmet listeleri (çalışan kişisel verisi) sızar. KVKK md. 12 veri güvenliği yükümlülüğü.
- **Öneri:** İş bitince (başarılı/başarısız) `jobs/<id>` silinsin, yalnız maskeli özet kalsın; açılışta 24 saatten eski iş klasörlerini temizle; SGK PDF önbelleğini bellek içi tut veya DPAPI ile şifrele; kanıt dosyası gerekiyorsa VKN/TCKN'yi özetle (hash) yaz.

## G-05
**KVKK: yurt dışı aktarım, saklama/imha, aydınlatma** — Yüksek (uyum)

- **Gözlem:** Kodda Supabase bölgesi belirtilmez (şablon URL). TCKN, SGK verisi, GİB şifresi Supabase'de. Saklama süresi, imha akışı, aydınlatma metni, VERBİS/veri işleme envanteri yok. Storage'da silme politikası yok (içerik adresli, değişmez).
- **Risk:** Proje AB/ABD bölgesindeyse KVKK md. 9 yurt dışı aktarım şartları (standart sözleşme + Kurul'a bildirim) gerekir. Mükellefin silme talebi karşılanamaz (JSONB + değişmez PDF).
- **Öneri:** Bölgeyi belgeleyin; veri işleme envanteri ve saklama süreleri (ör. VUK 5 yıl + 1) tanımlayın; Storage için yönetici silme fonksiyonu ve imha kaydı; mükellef bazında silme prosedürü.

## G-06
**CSP yok + elle kaçışlama** — Yüksek

- **Kanıt:** `eworks-tasarim.html` 7 `innerHTML` noktası (666, 961, 963, 1054, 1064, 1175, 1202), `safe()` ~160 kullanım (626). Köprü yanıtlarında `Content-Security-Policy` yok.
- **Risk:** GİB'den gelen bir unvan/uyarı metni veya içe aktarılan JSON'da tek bir kaçışlanmamış alan → XSS → bellekteki JWT → [G-02](#g-02) ile GİB şifresi. Zincir kritik sonuca götürür.
- **Öneri:** Köprüden `Content-Security-Policy: default-src 'self'; connect-src 'self' https://<proje>.supabase.co; script-src 'self'; object-src 'none'; frame-ancestors 'none'` (inline JS'in dosyaya taşınması gerekir; geçişte `'sha256-…'` özetleri); `innerHTML` yerine `textContent`/`replaceChildren`; `safe()` kullanımını ESLint kuralı ile zorunlu kılın.

## G-07
**Yerel köprü uç noktaları** — Orta

- **Kanıt:** `yerel-sunucu.py:121-126` `GET /api/connection` yalnız Host kontrolüyle `TOKEN` verir; `GET /api/jobs/<id>/result` yalnız token + owner UUID ister, JWT istemez (127-138); `/gib-sozlesmeler.json` kimliksiz sunulur (142).
- **Değerlendirme:** Tarayıcı tabanlı saldırı aynı köken politikası + Host kontrolüyle büyük ölçüde engellenir. Ancak aynı bilgisayardaki **herhangi bir süreç/kullanıcı** token'ı alıp sonuçları (VKN/TCKN listeleri) okuyabilir; owner UUID tahmin edilemez ama `status` yanıtlarında/loglarda görünebilir.
- **Öneri:** Sonuç ve durum GET'lerinde de JWT doğrulaması; `/api/connection`'da `Sec-Fetch-Site: same-origin` kontrolü; `/gib-sozlesmeler.json` servisini kaldırın; çok kullanıcılı Windows'ta köprüyü kullanıcıya özel adlandırılmış boruya veya rastgele porta taşıyın.

## G-08
**Çalışma anında kod yükleme** — Orta

- **Kanıt:** `portal_worker.py:57-64, 306-309`, `declaration_documents.py:107-108` — dosya mtime değişince `importlib.reload`. `yerel-sunucu.py:11` gitignore'daki `runtime/` klasörünü `sys.path` başına ekler.
- **Risk:** Robot klasörüne yazabilen bir süreç, GİB oturumu açık ve şifre bellekteyken kod çalıştırır. `runtime/xlrd.py` ile köprü açılışında kod çalıştırılır.
- **Öneri:** Hot-reload'u yalnız `EWORKS_DEV=1` ile açın; `runtime/` satırını kaldırın; kurulumu yazma izni kısıtlı klasöre (`Program Files`) yapın.

## G-09
**Bağımlılık tedarik zinciri** — Orta

- **Kanıt:** `requirements.txt` aralık sabitleme, kilit/özet yok; Edge `npm:@supabase/supabase-js@2`; ddddocr (ONNX modelleri içeren, az bakımlı paket) ayrı venv'de.
- **Öneri:** `pip-compile --generate-hashes` ile kilit; Edge'de tam sürüm; Dependabot/`pip-audit` CI adımı.

## G-10
**Yetim Vault sırları** — Orta

- **Kanıt:** `eworks_private.gib_accounts.user_id … on delete cascade` satırı siler, `vault.secrets` kaydını silmez; belge elle temizlik ister (`Supabase-GIB-Hesap-Kurulum.md:57-60`). Firma silindiğinde `firm_gib_accounts` da kalır (firma JSONB içinde, FK yok).
- **Öneri:** `before delete` tetikleyicisi ile `vault.secrets` silme; firma kaldırıldığında Edge `delete` eylemi; periyodik yetim tarama sorgusu.

## G-11
**Supabase yönetici erişimi** — Orta (belgede kabul edilmiş)

Proje sahibi/ekip üyeleri `vault.decrypted_secrets`'i okuyabilir. Öneri: Supabase organizasyonunda en az ayrıcalık, MFA zorunlu, yönetici erişim kayıtlarının periyodik gözden geçirilmesi; müşavire bu durumun aydınlatma metninde açıklanması.

## G-12
**MFA yok** — Orta

Portal `grant_type=password` ile girer; MFA/TOTP akışı görülmedi. Eworks hesabı GİB şifresine (G-02) giden yol olduğundan tek faktör zayıf halkadır. Öneri: Supabase Auth MFA (TOTP) zorunlu; `aal2` olmadan Edge `save`/`robot` reddi.

## G-13
**Hata metni sızıntısı / maskeleme** — Düşük

`ValueError` metinleri `str(exc)` ile arayüze ve `status.json`'a gider (GİB yanıt parçaları içerebilir). Edge tüm RPC hatalarını 409'a indirger (teşhisi zorlaştırır). Öneri: kullanıcıya sabit mesaj + korelasyon kimliği; ayrıntı maskeli log'a.

## G-14
**Değiştirilebilir loglar** — Düşük

`sistem_loglari` için kullanıcıya INSERT politikası var; loglar sahte kayıtla doldurulabilir (yalnız eski CLI). Öneri: eski CLI kaldırılırken tabloyu da kaldırın veya yazmayı SECURITY DEFINER fonksiyona alın.

## G-15
**Robot JWT ömrü** — Düşük

JWT stdin ile gelir (iyi), ancak beyanname senkronunda 2 saate kadar bellekte tutulur (`portal_worker.py:157`) ve yenilenmez; süresi dolunca Storage yüklemeleri başarısız olur. Öneri: kısa ömürlü iş bileti ([G-02](#g-02) öneri 1) ile birleştirin.

## G-16
**Demo kimlik bilgisi; `verify_jwt=false`** — Düşük

`hkazaz/docker/README.md:38` yerel demo kullanıcısının şifresini düz metin içerir (yalnız yerel Supabase için; gerçek ortamda kullanılmamalı). `config.toml` `verify_jwt=false`; JWT kontrolü yalnızca `index.ts`'deki koda bağlı — bir yeniden düzenlemede kaldırılırsa fonksiyon açık kalır. Öneri: `test_edge_function.mjs`'te "Authorization yok → 401" testi zorunlu tutulsun; mümkünse `verify_jwt=true` + kod içi kontrol (çift katman).
