<!-- gezinti — node tools/docs/gezinti.mjs --yaz üretir, elle düzenlemeyin -->
[README](../../README.md) › [Genel bakış](../00-genel-bakis.md) › [Bağlamlar](README.md) › **documents**
<!-- /gezinti -->

# documents — Belgeler

> Durum: **E aşaması (2026-10-25)**: kurumdan alınan PDF'lerin metaverisi, içerik özetiyle saklama, kapsamlı ve denetimli indirme, D15 saklama temizliği (işçi, saatte bir). Yönetici toplu temizlik ekranı ve tek belgelik "yeniden indir" işi yok. Kaynak: [06 §2](../hedef-mimari/06-kaynak-kod-yapisi-ddd-tdd.md#2-bounded-context-haritası-ve-ortak-dil), [02 §9](../hedef-mimari/02-kurum-entegrasyon-robotu.md#9-belge-pdf-saklama-ve-toplu-temizlik-d15). Kod: `packages/contexts/documents` — dışarıya yalnız `src/index.ts`.

| | |
|---|---|
| Sorumluluk | PDF metaverisi, saklama (vars. 7 gün, D15), toplu temizlik, yeniden indirme |
| Aggregate'ler (kök) | `Document` (tablo `documents.files`); `RetentionPolicy` = `DOCUMENT_RETENTION_DAYS`; `PurgeRun` henüz yok |
| Yayınladığı olaylar | `DocumentsPurged` (henüz yalnız denetim kaydı: `belge.saklama_suresi_doldu`) |
| Özellik anahtarları | `beyanname.belge.*`, `yonetim.belge_temizligi.*` |
| Veritabanı şeması | `documents` (shard); dosyalar S3 `org/<ofis>/belgeler/<sha256>.pdf` |

## Kurallar

- Türler: beyanname, vergi tahakkuku, SGK tahakkuku, SGK hizmet listesi. Boyut 100 B – 20 MB. Python ACL PDF'i yazmadan önce doğrular (başlık, `%%EOF`, okunabilir sayfa, şifresiz; eski `validate_pdf`).
- Dosya **içerik özetiyle** adreslenir; anahtar ofis önekli olmak zorundadır (veritabanı kısıtı + `validDocument`). Başka ofisin anahtarını taşıyan kayıt atlanır.
- Kayıt yalnız işçide (sistem bağlamı); kullanıcı kayıt ekleyemez. Okuma firma kapsamındadır (RLS `app.can_see_firm`); kapsam dışı belge 404.
- Her indirme denetim kaydına yazılır (`belge.indirildi`). İndirilen dosya adında kişisel veri yoktur (`KDV1-2026-08-beyanname.pdf`).
- **Saklama (D15):** son saklanmasının üzerinden `DOCUMENT_RETENTION_DAYS` (vars. 7) geçen dosya S3'ten parça parça silinir; satır `file_deleted_at` ile kalır, ekranda "saklama süresi doldu" görünür. Aynı belge yeniden alınınca dosya yeniden saklanır. Aynı içeriği kullanan başka bir satırın süresi dolmamışsa dosya silinmez.
- Ham robot sonucu (`org/<ofis>/sonuc/<iş>.json`) işçi uyguladıktan sonra silinir.

## BFF uçları ve ekranlar

- `GET /api/belgeler/:id` (`beyanname.belge.download`): S3'ten akış; süresi dolmuşsa 410.
- Ekranlar: `/beyanname/belge` (belge listesi), `/beyanname/liste` satırında belge bağlantıları.

## Testler

- Birim: `test/application/documents.test.ts`.
- Entegrasyon (gerçek yığın + S3): `test/infrastructure/belgeler.int.test.ts` (yalnız işçi kaydeder, başka ofis 404, indirme denetimi, saklama temizliği ve yeniden saklama).
- Kabul: `apps/web/e2e/beyanname.e2e.ts` — `beyanname.belge.view/download` yeşil.

## Açık işler

- Yönetici toplu temizlik ekranı (`yonetim.belge_temizligi.run`, önizleme + ofis adıyla onay), ofis bazında kısa saklama süresi, tek belgelik "yeniden indir" işi, `DocumentsPurged` olayı.

<!-- gezinti — node tools/docs/gezinti.mjs --yaz üretir, elle düzenlemeyin -->

---

[README](../../README.md) › [Genel bakış](../00-genel-bakis.md) › [Bağlamlar](README.md) › **documents**
<!-- /gezinti -->
