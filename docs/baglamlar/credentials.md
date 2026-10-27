<!-- gezinti — node tools/docs/gezinti.mjs --yaz üretir, elle düzenlemeyin -->
[README](../../README.md) › [Genel bakış](../00-genel-bakis.md) › [Bağlamlar](README.md) › **credentials**
<!-- /gezinti -->

# credentials — Kurum hesapları

> Durum: **C aşaması (2026-10-25)**: müşavir ve firma GİB hesabı (Vault), durum görüntüleme. Kullanım izni, mükellef onayı ve iş için sır okuma (D aşaması) yok. Kaynak: [06 §2](../hedef-mimari/06-kaynak-kod-yapisi-ddd-tdd.md#2-bounded-context-haritası-ve-ortak-dil), [05 §4](../hedef-mimari/05-yetki-ve-hesap-modeli.md). Kod: `packages/contexts/credentials` — dışarıya yalnız `src/index.ts`.

| | |
|---|---|
| Sorumluluk | Kurum hesabı, Vault, kullanım izni, mükellef onayı (D18), kilitlenme koruması |
| Aggregate'ler (kök) | `InstitutionAccount`, `CredentialGrant`, `CredentialConsent` |
| Yayınladığı olaylar | `AccountLockedOut`, `ConsentRevoked` (henüz yok) |
| Özellik anahtarları | `firmalar.kurum_hesaplari.*` |
| Veritabanı şeması | `credentials` (shard) + `vault` |

> **2026-10-27 (D42):** kurum türleri GİB, SGK (işyeri başına, `label` = işyeri adı), UETS; alanların hepsi Vault'ta (`credentials.save_account_secret`, kuruma göre tam alan listesi). e-Devlet şifresi saklanmaz. `liveStatus`: kurumda bilgi değişikliğinden sonra başarılı giriş → aktif; hatalı şifre/kilit/devre dışı → aktif değil; diğer → doğrulanmadı. Form alanları kapalı başlar (otomatik doldurma kilidi).

## Kurallar

- Kimlik bilgisi (kullanıcı kodu + şifre) **yalnız Vault'tadır**. Tabloda sır kimliği ve durum durur; sır kimliği sütunu ve `vault` şeması web rolüne kapalıdır. Şifre yanıtta, günlükte, hata mesajında, denetim kaydında yer almaz; form gönderildikten sonra temizlenir.
- Kayıt yalnız `credentials.save_account()` ile: müşavir hesabı → hesabın sahibi müşavir ya da ofis yöneticisi; firma hesabı → firmayı gören ofis yöneticisi/müşavir ya da firmaya bağlı mükellef kullanıcısı (D18). Yetki BFF'te (`firmalar.kurum_hesaplari.edit_credentials`) ve veritabanında denetlenir.
- Yeni bilgi girilince `wrong_password`/kilit durumu sıfırlanır (hatalı şifreli hesap bilgi değişene dek yeniden denenmez, 05 §4).
- Her kayıt `audit.record('kurum_hesabi.kaydedildi')` ile hash zincirli denetim kaydına yazılır.

## BFF uçları ve ekranlar

- `PUT /api/kurum-hesaplari` (yanıt yalnız durum).
- Ekranlar: `/firmalar/kurum_hesaplari` (müşavirin GİB hesabı + firmaların durumu), firma kartındaki "Firma GİB hesabı".

## Testler

- Birim: `test/application/accounts.test.ts`.
- Entegrasyon: `packages/contexts/portfolio/test/infrastructure/portfoy.int.test.ts` (Vault'a erişilemezlik, yetki, denetim zinciri); pgTAP `supabase/tests/tenant/portfolio/kapsam.sql`.
- Kabul: `apps/web/e2e/firmalar.e2e.ts` — `firmalar.kurum_hesaplari.view_status`, `.edit_credentials` yeşil.

## Açık işler

- İş için sır okuma (`eworks_integration` rolü, D aşaması), kullanım izni (`grant_use`), mükellef onayı (`consent`), SGK hesap alanları (kullanıcı adı, işyeri kodu, sistem ve işyeri şifresi).

<!-- gezinti — node tools/docs/gezinti.mjs --yaz üretir, elle düzenlemeyin -->

---

[README](../../README.md) › [Genel bakış](../00-genel-bakis.md) › [Bağlamlar](README.md) › **credentials**
<!-- /gezinti -->
