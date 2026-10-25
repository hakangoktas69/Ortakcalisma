# Test ve özellik durumu (TDD)

> Ayrıntı: [06 §7–§8](../hedef-mimari/06-kaynak-kod-yapisi-ddd-tdd.md#7-tdd-süreci-d22).

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
| Infrastructure | Vitest + Testcontainers | `…/test/infrastructure` | gerçek Postgres |
| Veritabanı (RLS, kısıt) | pgTAP | `supabase/tests/<ctx>` | gerçek Postgres |
| BFF ucu | Vitest | `apps/web/src/app/api/<ctx>/…test.ts` | oturum sahte, use-case + PG gerçek |
| UI bileşeni | Vitest + Testing Library | `apps/web/src/features/<ctx>/test` | yok |
| Kabul | Playwright (375 / 768 / 1366 / 1920) | `apps/web/src/features/<ctx>/test/*.e2e.ts` | çalışan yığın, sahte kurum sunucusu |
| ACL | pytest | `services/integration/tests` | sahte kurum sunucusu |
| Sözleşme | JSON Schema | her iki taraf | — |

Kapsam eşikleri: domain + application %90 satır / %80 dal; ACL ayrıştırıcıları %90. **Eşik düşürülmez.**

## Özellik durumu

- Koşucular: `pnpm test` (birim), `node tools/deploy/yigin.mjs test` (birim + `*.int.test.ts` entegrasyon + pgTAP; Compose yığınının ağında), `node tools/deploy/yigin.mjs e2e` (Playwright). Hepsi JUnit bırakır (`test-results/`); `pnpm features` (`tools/features/uret.ts`) etiketleri toplayıp `packages/feature-registry/feature-status.json`, [docs/ozellik-durumu.md](../ozellik-durumu.md) ve README özetini üretir.
- Kırmızı: anahtara bağlı test yok, ya da biri başarısız/atlanmış. **Kurumla konuşan işlem** (`live: true`, D33) ayrıca `packages/feature-registry/canli-dogrulamalar.json` kaydı ister: sahte GİB testleri geçse de canlı koşu kaydı girilene kadar kırmızıdır. Yeşil: en az bir test var ve hepsi geçiyor. Ana düğüm alt işlemlerden hesaplanır (ör. "e-Bildirge 2/3").
- Ön yüzde `<FeatureGate>`/`<FeatureBadge>`: kırmızı düğüm kırmızı çerçeve + "Geliştiriliyor" metni ve simgesi; **tüm ortamlarda tüm kullanıcılara** görünür (D30); uygulanmamış işlem sunucuda 501.

## Bir işi tamamlarken

`pnpm verify` (tip, mimari, test, hafıza, ajan senkronu, bağlantılar) yeşil olmadan iş bitmez; arayüz değiştiyse dört ekran sınıfında kabul testleri. Koşulamayan adım varsa kullanıcıya açıkça söylenir.
