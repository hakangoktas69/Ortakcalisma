<!-- gezinti — node tools/docs/gezinti.mjs --yaz üretir, elle düzenlemeyin -->
[README](../../README.md) › [Genel bakış](../00-genel-bakis.md) › [Bağlamlar](README.md) › **sales**
<!-- /gezinti -->

# sales — Satış portalı

> Durum: **çekirdek aşama (2026-10-26, D40)**: satışçı girişi (zorunlu TOTP), ofis listesi, yeni ofis (+ yönetici müşavir + deneme lisansı). Dondurma, lisans uzatma, satış ekibi ve mükellef sözleşmesi sonraki aşamada (o `satis.*` anahtarları kırmızı). Kaynak: [06 §2](../hedef-mimari/06-kaynak-kod-yapisi-ddd-tdd.md#2-bounded-context-haritası-ve-ortak-dil), [08 §2](../hedef-mimari/08-depo-yeniden-yapilanmasi.md#2-satış-portalı-d27), [karar kaydı K-47](../adr/karar-kaydi.md). Kod: `packages/contexts/sales` — dışarıya yalnız `src/index.ts`; uygulama `apps/sales`.

| | |
|---|---|
| Sorumluluk | Satış kullanıcıları, ofis/müşavir/mükellef hesabı açma, sözleşme ve mükellef onayı kaydı, dondurma, shard ataması (D27), ofisin paket ve deneme/lisans kaydı (D40). **Mükellef iş verisini görmez** |
| Aggregate'ler (kök) | `SalesUser` (`sales.users`), `SalesAccount` (`sales.accounts`), `SalesContract` (sonraki aşama) |
| Yayınladığı olaylar | `OrganizationProvisioned`, `TaxpayerProvisioned` (henüz outbox yok; ofisin denetim kaydına `hesap.*` yazılır) |
| Özellik anahtarları | `satis.*`; bu aşamada kabul testli: `satis.oturum.login`, `satis.oturum.mfa`, `satis.ofis.view`, `satis.ofis.create` |
| Veritabanı | Kontrol düzlemi `sales` şeması (kullanıcılar, satış hesapları, hash zincirli `audit_entries`) + `directory`'de ofis açma; shard'da yalnız fonksiyonlar (`sales.open_organization`, `sales.add_member`, `sales.is_member`). Rol `eworks_sales` |

## Kurallar

- Satış kullanıcıları portal kimliğinden (GoTrue) ayrıdır: satışçı portala, müşavir satış portalına giremez. Giriş: e-posta + parola → **zorunlu TOTP** (ilk girişte QR ile kurulum; 10 tek kullanımlık kurtarma kodu bir kez gösterilir). Aynı kod iki kez geçmez (son adım saklanır). 5 hatalı parola ya da kod 15 dk kilitler; ara adımda 5 yanlış kod adımı düşürür. Geçici parola ilk girişte değiştirilir; parola değişince diğer oturumlar düşer.
- TOTP gizli anahtarı veritabanında AES-256-GCM ile mühürlüdür (`SALES_TOTP_KEY`); parola scrypt özetidir. Yalnız `node:crypto` (QR çizimi için `qrcode`).
- Ofis, en az ofisi olan ve yeni ofis kabul eden shard'a açılır (07 §2.3). Sıra: kimlik (GoTrue) → kontrol düzlemi dizini → shard; e-posta başka parolayla kayıtlıysa ofis hiç açılmaz. Satış aynı adla ikinci ofis açmaz (Türkçe harf kurallarıyla büyük/küçük harf duyarsız: "Ofisi" = "OFİSİ"); aynı ad için eşzamanlı iki istek Redis kilidiyle engellenir. Veritabanında tekil indeks yoktur: hesap açma komutu ve eski testler aynı adlı ofisleri yerel veritabanlarında bırakmış olabilir (indeks migration'ı onları durdururdu).
- Ofis yöneticisi aynı zamanda müşavir kaydı alır (portföy sahibi olabilsin). Kendi kendine kayıt kapalıdır (GoTrue `DISABLE_SIGNUP`).
- Paket (Başlangıç / Pro / Kurumsal) ve deneme süresi (varsayılan 14, en çok 90 gün) satış hesabında kayıttır; **portala girişi engellemez** (D40; dondurma engeller). Satış hesabı olmayan ofis (komutla açılmış) listede "süresiz"dir.
- `eworks_sales` rolü shard'da hiçbir tabloya erişemez ve `authenticated` üyesi değildir; yalnız hesap açma fonksiyonlarını çağırır. Kontrol düzleminde VKN dizinini göremez, ofisi değiştiremez ya da silemez.
- Ofisi etkileyen her işlem iki zincire yazılır: satış (`sales.audit_entries`, ör. `satis.ofis.acildi`) ve ofisin kendi denetim kaydı (`hesap.ofis_acildi`, `hesap.uye_eklendi`; kaynak + satış kullanıcısı). Denetime kişisel veri (e-posta, telefon) yazılmaz.
- Hesap açma komutu tekrarlanabilir: aynı ofis adı ve aynı kullanıcı (aynı parola) çoğaltılmaz. Parola en az 12 karakterdir ve komut satırında verilmez.

## BFF uçları ve ekranlar (`apps/sales`, port 8081)

| Ekran / uç | Anahtar | Not |
|---|---|---|
| `/giris`, `POST /api/oturum/giris` | açık | Parola adımı; ara adım çerezi (≤ 15 dk) |
| `/giris/kurulum`, `POST /api/oturum/kurulum` | açık (ara adım) | QR + anahtar; kurtarma kodları yanıtta bir kez |
| `/giris/dogrula`, `POST /api/oturum/dogrula` | açık (ara adım) | Kod ya da kurtarma kodu |
| `/sifre`, `POST /api/oturum/sifre` | `satis.oturum`, `satis.oturum.login` | Geçici parola önce burada değişir |
| `/` | `satis.ofis` | Ofis listesi, arama, durum süzgeci |
| `/yeni`, `POST /api/ofisler` | `satis.ofis.create` | Geçici parola yanıtta bir kez |
| `POST /api/oturum/cikis` | `satis.oturum` | CSRF belirteçli form |

İlk satışçı komutla açılır: `node tools/deploy/yigin.mjs satis-kullanici --eposta … --ad "…"` (geçici parola ekrana bir kez). Ofisi komutla açmak için `hesap-ac` (demo, kabul testleri) sürer.

## Testler

- Birim: `test/domain/sales.test.ts`, `test/application/{sales-auth,offices,provisioning}.test.ts`, `test/infrastructure/kripto.test.ts` (RFC 4226/6238 vektörleri). Yetki anahtarı taraması: `apps/sales/src/bff/yetki-anahtarlari.test.ts`.
- pgTAP: `supabase/tests/control/sales.sql`, `supabase/tests/tenant/sales/hesap_acma.sql`. Entegrasyon (gerçek roller): `apps/sales/test/satis.int.test.ts`. Kabul (4 ekran): `apps/sales/e2e/satis.e2e.ts`; müşavirin geçici parolayla portala girişi dahil.

## Açık işler

- Ofis dondurma (`satis.ofis.freeze`), lisans uzatma (`satis.ofis.extend`), satış ekibi ekranı (`satis.ekip.*`), müşavir/mükellef ekleme ve sözleşme + mükellef onayı (`satis.musavir.*`, `satis.mukellef.*`).
- Açık konular 18–22 ([durum](../ai/durum.md#açık-konular)): lisansın girişi engellemesi, portalda geçici parolanın zorunlu değişimi, üretimde yayın, ortak log yardımcısı, ofis açmada yarım kalma (telafi yok).
- **Bilinen sapma:** shard'daki `sales.*` fonksiyonları `organization` ve `identity_access` tablolarına yazar/okur (supabase kuralı: başka bağlamın tablosuna yazan fonksiyon yazılmaz). Hesap açma bu tablolara zaten yazıyordu (önceden işçi rolüyle doğrudan); fonksiyonlar yazmayı tek, denetimli ve dar bir yola topladı. Kalıcı çözüm: `organization` / `identity-access` bağlamlarının kendi hesap açma fonksiyonları ve satıştan olayla tetiklenmesi.

<!-- gezinti — node tools/docs/gezinti.mjs --yaz üretir, elle düzenlemeyin -->

---

[README](../../README.md) › [Genel bakış](../00-genel-bakis.md) › [Bağlamlar](README.md) › **sales**
<!-- /gezinti -->
