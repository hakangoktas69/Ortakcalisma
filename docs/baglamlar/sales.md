<!-- gezinti — node tools/docs/gezinti.mjs --yaz üretir, elle düzenlemeyin -->
[README](../../README.md) › [Genel bakış](../00-genel-bakis.md) › [Bağlamlar](README.md) › **sales**
<!-- /gezinti -->

# sales — Satış portalı

> Durum: **B aşaması (2026-10-25)**: hesap açma use-case'i ve komutu. Satış portalı ekranı yok, `satis.*` kırmızı. Kaynak: [06 §2](../hedef-mimari/06-kaynak-kod-yapisi-ddd-tdd.md#2-bounded-context-haritası-ve-ortak-dil), [08 §2](../hedef-mimari/08-depo-yeniden-yapilanmasi.md#2-satış-portalı-d27). Kod: `packages/contexts/sales` — dışarıya yalnız `src/index.ts`.

| | |
|---|---|
| Sorumluluk | Satış kullanıcıları, ofis/müşavir/mükellef hesabı açma, sözleşme ve mükellef onayı kaydı, dondurma, shard ataması (D27). **Mükellef iş verisini görmez** |
| Aggregate'ler (kök) | `SalesUser`, `SalesAccount`, `SalesContract` |
| Yayınladığı olaylar | `OrganizationProvisioned`, `TaxpayerProvisioned` |
| Özellik anahtarları | `satis.*` |
| Veritabanı şeması | `sales` (kontrol düzlemi; henüz yok) |

## Kurallar

- Ofis, en az ofisi olan ve yeni ofis kabul eden shard'a açılır (07 §2.3). Kayıt önce kontrol düzlemi dizinine, sonra shard'a yazılır.
- Ofis yöneticisi aynı zamanda müşavir kaydı alır (portföy sahibi olabilsin). Kendi kendine kayıt kapalıdır (GoTrue `DISABLE_SIGNUP`).
- Hesap açma tekrarlanabilir: aynı ofis adı ve aynı kullanıcı (aynı parola) çoğaltılmaz. Parola en az 12 karakterdir ve komut satırında verilmez (ortamdan okunur).

## BFF uçları ve ekranlar

- Satış portalı ekranı yok. Ara çözüm: `node apps/worker/src/hesap-ac.ts ofis|uye|demo` (Compose görevi `hesap-ac`; demo profilinde `yigin.mjs up` çalıştırır).

## Testler

- Birim: `test/application/provisioning.test.ts`. Uçtan uca: identity-access giriş entegrasyon testi ve kabul testlerinin genel kurulumu bu use-case'i kullanır.

## Açık işler

- `apps/sales` ekranı, `SalesUser` (zorunlu iki adımlı doğrulama), sözleşme ve mükellef onayı kaydı, ofis dondurma.

<!-- gezinti — node tools/docs/gezinti.mjs --yaz üretir, elle düzenlemeyin -->

---

[README](../../README.md) › [Genel bakış](../00-genel-bakis.md) › [Bağlamlar](README.md) › **sales**
<!-- /gezinti -->
