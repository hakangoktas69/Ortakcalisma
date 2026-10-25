# Test ve özellik durumu (TDD)

> Ayrıntı: [06 §7–§8](../hedef-mimari/06-kaynak-kod-yapisi-ddd-tdd.md#7-tdd-süreci-d22). Örnekli uygulama rehberi: [gelistirici-rehberi/tdd.md](../gelistirici-rehberi/tdd.md).

## Akış (her özellik = yetki ağacında bir işlem)

1. `packages/feature-registry/src/features.ts`'e anahtar (ör. `sgk.ebildirge.sync`) — durum kendiliğinden **kırmızı**.
2. Kullanıcı gözünden **kabul testi**, etiketli: `test('@F:sgk.ebildirge.sync …')` veya `describe('[F:sgk.ebildirge.sync] …')`; pytest'te `@pytest.mark.feature("…")`. Önce kırmızı.
3. İçten dışa birim testleri: domain → application → infrastructure → BFF → UI; her biri önce kırmızı.
4. En az kodla yeşil, sonra refactor.
5. Anahtara bağlı tüm testler yeşil → özellik **yeşil** (CI hesaplar, elle işaretlenmez).

Hata düzeltme de TDD'dir: önce hatayı üreten test. Kural ihlali, yetkisizlik (403), başka ofisin kaydı (404), mükellefin müşavir hesabını kullanma girişimi (red) test olarak yazılır.

**Etiketi yalnız o özelliği gerçekten doğrulayan teste koy.** Altyapı veya kayıt testine etiket koymak özelliği haksız yere yeşile çevirir.

## Katmanlar

| Katman | Araç | Yer | Gerçek bağımlılık |
|---|---|---|---|
| Domain | Vitest | `packages/contexts/<ctx>/test/domain` | yok |
| Application | Vitest | `…/test/application` | in-memory repository, sahte saat |
| Infrastructure | Vitest | `…/test/infrastructure/*.int.test.ts` | Compose yığını (gerçek Postgres, Redis, RabbitMQ, S3, GoTrue) |
| Veritabanı (RLS, kısıt) | pgTAP | `supabase/tests/{control,tenant}/<şema>` | gerçek Postgres |
| İşçi | Vitest | `apps/worker/test` | in-memory |
| Yetki anahtarı bildirimi | Vitest (rota taraması) | `apps/web/src/bff/yetki-anahtarlari.test.ts` | yok |
| BFF ucu, UI bileşeni | — | henüz yok; ilk yazan `apps/web/src/app/api/<ctx>/…test.ts`, `apps/web/src/features/<ctx>/test` | — |
| Kabul | Playwright (375 / 768 / 1366 / 1920) | `apps/web/e2e/*.e2e.ts` | çalışan yığın, sahte kurum sunucusu |
| ACL | pytest | `services/integration/tests` | sahte kurum sunucusu |
| Sözleşme | JSON Schema | her iki taraf | — |

Kapsam eşikleri: domain + application (+ `packages/kernel`) %90 satır / %80 dal — `pnpm test:kapsam`, `pnpm verify` ve CI (`test:ci`) zorlar ([vitest.config.ts](../../vitest.config.ts)); altyapı adaptörleri birim kapsamına girmez, yığında test edilir. ACL ayrıştırıcıları %90. **Eşik düşürülmez.**

## Özellik durumu

- Koşucular: `pnpm test` (birim), `node tools/deploy/yigin.mjs test` (birim + `*.int.test.ts` entegrasyon + pgTAP; Compose yığınının ağında), `node tools/deploy/yigin.mjs e2e` (Playwright). Hepsi JUnit bırakır (`test-results/`); `pnpm features` (`tools/features/uret.ts`) etiketleri toplayıp `packages/feature-registry/feature-status.json`, [docs/ozellik-durumu.md](../ozellik-durumu.md) ve README özetini üretir.
- Kırmızı: anahtara bağlı **kabul testi** (Playwright, `test-results/e2e*.xml`) yok, ya da anahtara bağlı herhangi bir test (birim, entegrasyon, pgTAP, kabul) başarısız/atlanmış. Birim testleri de etiketlenir ama tek başına yeşil yapmaz. **Kurumla konuşan işlem** (`live: true`, D33) ayrıca `packages/feature-registry/canli-dogrulamalar.json` kaydı ister: sahte GİB testleri geçse de canlı koşu kaydı girilene kadar kırmızıdır. Yeşil: en az bir test var ve hepsi geçiyor. Ana düğüm alt işlemlerden hesaplanır (ör. "e-Bildirge 2/3").
- Ön yüzde `<FeatureGate>`/`<FeatureBadge>`: kırmızı düğüm kırmızı çerçeve + "Geliştiriliyor" metni ve simgesi; **tüm ortamlarda tüm kullanıcılara** görünür (D30); uygulanmamış işlem sunucuda 501.

## Bir işi tamamlarken

Ajanlar kod değiştiren işte `gelistir` becerisini (`docs/ai/beceriler/gelistir.md`) uygular. `pnpm verify` (tip, mimari, birim testleri + kapsam eşiği, yetki anahtarı denetimi, hafıza, ajan senkronu, bağlantılar) yeşil olmadan iş bitmez; arayüz değiştiyse dört ekran sınıfında kabul testleri. Koşulamayan adım varsa kullanıcıya açıkça söylenir.
