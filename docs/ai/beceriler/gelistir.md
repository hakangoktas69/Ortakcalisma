---
name: gelistir
description: Kod değiştiren her işte DDD sınırları ve TDD döngüsüyle çalışma akışı — yeni özellik, işlem, ekran, uç, kural, migration, hata düzeltme ya da refactor. "Şu özelliği ekle", "şunu geliştir", "hatayı düzelt", "uç/ekran/tablo ekle", "/gelistir" dendiğinde ya da packages/, apps/, services/, supabase/ altında kod yazmadan önce kullan.
---

# Geliştir (DDD + TDD akışı)

Amaç, sistemi bozmadan değişiklik yapmak: doğru bağlamda, önce kırmızı test, en az kod, araçla doğrulanmış yeşil. Adımları sırayla uygula; atladığın ya da koşamadığın adımı kullanıcıya açıkça söyle.

Kavramlar ve gerekçe: `docs/gelistirici-rehberi/ddd.md` ve `docs/gelistirici-rehberi/tdd.md`. Bu becerinin adımları onların özetidir; ayrıntı gerektiğinde ilgili bölümü oku.

## 0. Bağlamı topla (koda dokunmadan)

1. `docs/ai/durum.md`: süren iş, açık konular. İş bir açık konuya değiyorsa kullanıcıya söyle.
2. İşin **bağlamını** belirle: `docs/ai/mimari.md` bağlam tablosu → `docs/baglamlar/<ctx>.md` → `packages/contexts/<ctx>/src/index.ts`. İş iki bağlama da uyuyorsa ya da yeni bir bağlam gerektiriyorsa **dur ve sor**; yeni bağlam bir karardır (D-NN/K-NN).
3. Çalışacağın dizindeki `CLAUDE.md`'yi oku (`packages/contexts`, `packages/kernel`, `packages/feature-registry`, `apps/*`, `services/integration`, `supabase`).
4. Kural belirsizse ya da kurum (GİB/SGK) davranışı doğrulanmamışsa varsayım yapma: açık konuya yazılmasını öner ve sor.

## 1. Planı kullanıcıya kısaca söyle

Bağlam, özellik anahtarı, dokunulacak katmanlar (domain / application / infrastructure / migration / BFF / UI), yazılacak testler. Yeni terim varsa `docs/ai/mimari.md` sözlüğüne önerilen İngilizce karşılık.

## 2. Özellik kaydı ve kırmızı kabul testi

- Yeni işlemse anahtarı `packages/feature-registry/src/features.ts`'e ekle (kırmızı başlar). Var olan işlemse anahtarı bul.
- Kullanıcı gözünden kabul testi: `apps/web/e2e/<alan>.e2e.ts`, adında `@F:<anahtar>`. Kurumla konuşan işlemse `live: true` ve sahte kurum sunucusu.
- **Hata düzeltmede** bu adımın yerine: hatayı en düşük katmanda yeniden üreten test.

## 3. İçten dışa döngüler (her biri: kırmızı → yeşil → düzenleme)

Her testi yazdıktan sonra **çalıştır ve doğru sebepten kırmızı olduğunu gör**; kırmızı çıktının özünü kullanıcıya raporla. Sonra yalnız testi geçirecek kadar kod yaz.

| Sıra | Yer | Kural |
|---|---|---|
| Domain | `packages/contexts/<ctx>/src/domain` + `test/domain` | Saf: G/Ç, `Date.now()`, rastgele, `process.env` yok. Beklenen hata `Result` ya da alan hata listesi |
| Application | `src/application` + `test/application` | Use-case `(ctx, girdi, can, d)`; bağımlılıklar port; testte `Map` tabanlı in-memory port, mock kütüphanesi yok. Her hata kodu bir testte |
| Migration + pgTAP | `supabase/migrations`, `supabase/tests` | Bağlam önekli, idempotent; PK `(org_id, id)`; RLS + başka ofis/kapsam dışı testi |
| Infrastructure | `src/infrastructure` + `test/infrastructure/*.int.test.ts` | Yalnız kendi şeması; `withUser`; denetim kaydı aynı işlemde |
| Public API | `src/index.ts` | Adıyla dışa aktar; başka bağlam yalnız buradan |
| BFF | `apps/web/src/app/api/...` | Tek yetki anahtarı (`apiIzni`), gövde doğrulama, `Result` → HTTP eşleme, sabit Türkçe mesaj |
| UI | `apps/web/src/app/(panel)/...`, `src/features/<ctx>` | `sayfaIzni('<anahtar>')`; iş kuralı yok |

Etiketi (`@F:` / `[F:]`) yalnız o özelliği gerçekten doğrulayan teste koy. Testi geçirmek için testi zayıflatma, `skip` bırakma, kapsam eşiğini düşürme.

## 4. Pazarlıksız kuralları kontrol et

Kiracı izolasyonu ve RLS; kurum şifresi yalnız Vault'ta; tarayıcıda gizli bilgi yok (`NEXT_PUBLIC_*` yok); kurum isteği hız sınırlayıcıdan; bağlam sınırı; kişisel veri log/fikstür/belgeye girmez (sahte üretici `@eworks/testing`); sır commit edilmez. Ayrıntı: kök `CLAUDE.md` ve `docs/ai/kurallar.md`.

## 5. Doğrula

- `pnpm verify`: tip, `pnpm arch`, birim testleri **kapsam eşiğiyle**, yetki anahtarı denetimi, hafıza, senkron, bağlantılar. Yerel Node 24 değilse `sh tools/deploy/dogrula.sh`.
- Entegrasyon, pgTAP veya migration değiştiyse `node tools/deploy/yigin.mjs test`; arayüz değiştiyse `node tools/deploy/yigin.mjs e2e` (dört ekran).
- Koşamadığın doğrulamayı "geçti" diye raporlama; hangisinin koşulmadığını ve nedenini söyle.

## 6. Belgele ve bitir

- `docs/baglamlar/<ctx>.md`: kural, uç, ekran, test dosyası. Mimari/kural değiştiyse ilgili `docs/ai/*.md` ve karar kaydı (`docs/ai/kurallar.md` "Kararlar ve belgeler nasıl işlenir").
- `node tools/ajan/bitir.mjs --ajan claude|codex` çıktısındaki adımları uygula.
- Raporda: hangi testler önce kırmızıydı, şimdi ne yeşil, hangi doğrulama koşuldu, hangisi koşulamadı.
