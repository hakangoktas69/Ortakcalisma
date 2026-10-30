---
name: eworks-demo-verisi
description: "Demo kipi sentetik verisi (2026-10-29): demo-veri işçi görevi, dilimler, sahte veri yalnız demo kipinde kuralı, Vault kök anahtarı düzeltmesi, Mert'in paralel çözümüyle çakışma"
metadata:
  node_type: memory
  type: project
  originSessionId: 0ca2c05c-bbaf-400e-9fcd-87d52685c8cf
  modified: 2026-10-30T08:30:00.000Z
---

Hakan'ın 2026-10-29 talimatı: "Eksik kısımları mockup/sahte/demo verileri kullanacak şekilde önden tamamlayın, **çalışmayan sayfa kalmasın**"; 13:01 ve 14:56'da netleştirdi: **demo kipinde yalnız sahte veri, diğer bütün kiplerde (gelistirme, debug, uretim) canlı entegrasyon ve gerçek veri**. Dal: `hakan/demo-veri` (main'den), 4 commit, push edildi.

## Ne yapıldı

`apps/worker/src/demo-veri.ts` tek giriş noktası; dilimler ayrı dosyalarda: `demo-rastgele.ts` (tohumlu üreteçler, sahte VKN/TCKN), `demo-tebligat.ts`, `demo-beyanname.ts` (beyanname + SGK + GİB sözleşmesi), `demo-calisma.ts` (görev, not, kurum hesabı, mükellef onayı), `demo-belge.ts` (gerçek PDF). Compose görevi `demo-veri`, `yigin.mjs` yalnız demo kipinde çağırır.

**Kritik tasarım kararı:** veri doğrudan veritabanına yazılmaz, **gerçek use-case'lerden geçer** (`createFirm`, `importNotices`, `importFilingContracts` → `importDeclarations` → `importFilings`, `saveAccount`, `recordConsent`, `createTask`). Böylece erişim kanıtı, dönem denetimi, alan doğrulaması ve RLS gerçekten çalışır. Bu use-case'lerin **sessizce saydığı** sonuçlar (`erisim_yok`, `basarisiz`, `firma_yok`, `vkn_kayitli` dışındaki hatalar) tohumlayıcıda **hataya çevrilir** — yoksa ekran boşken komut "başarılı" derdi.

**Tekrar çalıştırılabilirlik:** tohum **ofis adından** türetilir (`adTohumu`), çünkü VKN dizini (`directory.taxpayer_registry`) sistem genelinde tekildir — sabit tohumla ikinci demo ofisine hiç kayıt açılamıyordu. Görev ve notun doğal anahtarı olmadığı için mevcut kayıtlar okunup yalnız eksikler yazılır. Belgeler içerik özetinden (`storageKey`) anahtarlanır.

**Belgeler gerçek PDF'tir** (tek sayfa, geçerli xref), demo S3'e yazılır, indirme uçtan uca çalışır. Testler xref bayt konumlarını ve akış uzunluğunu da doğrular.

## Kip kuralı (D-NN adayı, Hakan 29.10 14:56)

`profil(env)` artık yalnız **demo kipinde** (ve test/e2e koşusunda) `demo` döner; `gelistirme`/`debug` kiplerinde sahte GİB kaldırılır ve `kurumOrtami()` ile `EWORKS_ORTAM=gelistirme`, `GIB_SAHTE_SUNUCU=''` verilir → istekler gerçek kuruma gider. **Test ve e2e kipten bağımsız olarak sahte GİB'e bağlanır** (testler kuruma istek atmaz). Demo hesabı (`demo@eworks.test`) gelistirme/debug'da **kalır** (veri değil, oturum; yoksa portala girilemez) — Hakan'ın onayı bekleniyor.

**Tuzak:** kip değişince **veritabanı değişmez**; demo kipinde üretilmiş sentetik kayıtlar gelistirme kipinde de durur. `kipKur` artık uyarı basıyor; tek gerçek çözüm `yigin.mjs down --sil`.

## Vault kök anahtarı hatası (düzeltildi)

Supabase imajındaki `pgsodium_getkey.sh` anahtarı `/etc/postgresql-custom/pgsodium_root.key` içinde arar ve **yoksa rastgele üretir**; bu yol veri biriminde değil **container dosya sisteminde**. Container her yeniden oluşturulduğunda (imaj güncellemesi, ortam değişikliği, kip geçişi) anahtar değişiyor ve o ana dek saklanmış **bütün kurum şifreleri** `pgsodium_crypto_aead_det_decrypt_by_id: invalid ciphertext` ile çözülemez hale geliyordu. Üretimde Postgres imajını güncellemek aynı sonucu verirdi. Anahtar artık `deploy/compose/vault-anahtarlari/<db>.key` altında üretilip bağlanıyor (gitignore'da, `vaultAnahtarlari()` üretir). **Yedeğe bu dizin de girmeli** (açık konu 17).

## Açık: Mert'le çakışma

`mert/demo-ekran-tamamlama` dalı aynı işi **farklı yöntemle** yapıyor: demo kipinde `(panel)/layout.tsx` gerçek sayfaları devre dışı bırakıp yerine `DemoRouter` maket arayüzünü koyuyor (`apps/web/src/shared/demo/*`). İkisi aynı anda duramaz: ikisi de main'e girerse demo kipinde Mert'in arayüzü kazanır ve veritabanındaki sentetik veri hiç görünmez. Dosya çakışması yalnız `apps/web/src/app/globals.css`. **Hangi yöntemin seçileceği Hakan'ın kararı; sorulmayı bekliyor.**

## Kalan işler

- **Tebligat'ta gerçek veri** (Hakan 13:01): mükellefin GİB hesabı + mükellef onayı + canlı doğrulama kaydı (D33) gerekiyor; ajan kurum şifresi girmez, kullanıcı girer.
- `/beyanname/senkron` ve canlı entegrasyon yolu gerçek hesapla hiç denenmedi.
- Görsel güncellemelerin demo sayfalarına da yansıması (Hakan 30.10 10:58) ayrı iş olarak bekliyor.
- `firmalar.e2e.ts:144` kararsız (flaky): iki SGK işyeri kaydedilince başarı mesajı kapsamsız arandığı için "strict mode violation" veriyor (açık konu 33).

**Why:** Demo verisi ürünün vitrini; yanlış kurgulanırsa ya ekran boş kalır ya da gerçek veri demoya sızar.
**How to apply:** Yeni ekran eklendiğinde demo dilimi de eklenir. Sahte veri üreten kod `demo-*` dosyalarında kalır, üretim koduna sahte veri gömülmez. İlgili: [[eworks-acik-konular]], [[eworks-etebligat-kararlari]]
