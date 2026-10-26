<!-- gezinti — node tools/docs/gezinti.mjs --yaz üretir, elle düzenlemeyin -->
[README](../../README.md) › [Genel bakış](../00-genel-bakis.md) › **TDD rehberi**
<!-- /gezinti -->

# TDD uygulama rehberi

> TDD'ye yeniyseniz önce: [TDD nedir, ne işe yarar?](tdd-nedir.md) — red–green–refactor döngüsü, avantajları, ne zaman kullanılır.
> Hedef ve gerekçe: [hedef-mimari/06 §7–§8](../hedef-mimari/06-kaynak-kod-yapisi-ddd-tdd.md#7-tdd-süreci-d22) (D22, D33, D39). Kısa kurallar: [ai/test.md](../ai/test.md). Katmanlar ve sınırlar: [ddd.md](ddd.md).

Sayfa, [tdd-nedir.md](tdd-nedir.md)'deki sırayı izler: TDD bu projede nedir (§1), döngü nasıl işler (§2), avantajlar nasıl elde edilir (§3), örnekler (§4), zorlayıcı durumlar (§5). Sonda başvuru bölümü vardır: test katmanları, etiketler, kurallar, komutlar (§6).

## 1. Bu projede TDD nedir

"Önce test, sonra kod" ilkesi Eworks'te **iki düzeyde** işler. İkisi de "kırmızı" ve "yeşil" der ama farklı şeyleri anlatır:

| | Test düzeyi | Özellik düzeyi |
|---|---|---|
| Birim | Tek test | Yetki ağacındaki bir işlem (`gorevler.assign`) |
| Kırmızı | Test başarısız | İşlem tamamlanmadı: anahtara bağlı kabul testi yok ya da bir testi geçmiyor |
| Yeşil | Test geçiyor | En az bir kabul testi var ve anahtara bağlı tüm testler geçiyor; kurumla konuşan işlemde canlı doğrulama kaydı da var (D33) |
| Kim çevirir | Geliştirici, dakikalar içinde | CI, test sonuçlarından (`pnpm features`); **elle çevrilmez** |
| Nerede görünür | Test çıktısı | Arayüzde `gelistirme`/`debug` kipinde "Geliştiriliyor" (D39; demo/üretimde gizli), [ozellik-durumu.md](../ozellik-durumu.md) |

Özellik ağacı = yetki ağacı = durum kaynağı: [features.ts](../../packages/feature-registry/src/features.ts). Kayda giren her işlem kırmızı başlar; sunucuda uygulanmamış işlem `501` döner. Bir özellik, içinde onlarca test düzeyi döngüsü dönerek yeşile ulaşır (§4.2).

## 2. Döngü: kırmızı – yeşil – düzenleme

### 2.1 Kırmızı

- Tek bir davranış için küçük bir test yaz; adı davranışı Türkçe anlatsın (`'tamamlanmış görev gecikmiş sayılmaz'`).
- Testi çalıştır ve **doğru sebepten** düştüğünü gör. Derleme hatası (fonksiyon yok) ilk kırmızıdır; asıl kırmızı, beklenen değerin tutmamasıdır. Hiç kırmızı görülmeden yeşil olan test hiçbir şeyi kanıtlamaz.
- Test bir özelliği doğruluyorsa etiketini şimdi koy (`@F:<anahtar>`, §6.2).

### 2.2 Yeşil

- Testi geçirecek **en az** kodu yaz; henüz test edilmeyen durumu öngörüp kod ekleme. Sıradaki durum, sıradaki kırmızı testle gelir.
- Beklenen hata `Result` değeri olarak döner (`err('yetki_yok')`); testte ona bakılır ([ddd.md §3.6](ddd.md#36-uygulama-servisi--use-case-ek)).
- Testi geçirmek için testi zayıflatma; test yanlışsa nedenini commit mesajında yaz.

### 2.3 Düzenleme (refactor)

Yalnız tüm testler yeşilken yapılır ve **davranışı değiştirmez**; yeni davranış yeni bir kırmızı testle başlar. Bu projede düzenlemenin tipik konuları:

- Kuralı doğru katmana taşımak: use-case ya da BFF'te kalmış iş kuralını `domain`'e adlandırılmış saf fonksiyon olarak almak.
- Adları ortak dile uydurmak ([ai/mimari.md](../ai/mimari.md#ortak-dil-tr--kod) sözlüğü).
- Tekrarı gidermek; sabit değeri adlandırmak (`DONE`).
- Sonunda `pnpm test` ve `pnpm arch` yeşil kalmalı: düzenleme katman kuralını bozmamalı.

### 2.4 Hata düzeltme de bir döngüdür

1. Hatayı **en düşük katmanda** üreten testi yaz (çoğunlukla domain ya da application); kırmızı olduğunu gör.
2. Hata bir kabul senaryosunda görüldüyse o senaryoyu yeniden üreten adımı kabul testine de ekle.
3. Düzelt, yeşil; testin adı hatayı anlatsın (`'eski sürümle güncelleme çatışmadır'`).

## 3. Avantajlar bu projede nasıl elde edilir

| Avantaj ([tdd-nedir §3](tdd-nedir.md#3-tdd-ne-işe-yarar-avantajları-nelerdir)) | Eworks'te sağlayan mekanizma |
|---|---|
| Hata payını en aza indirir | Güvenlik ve kiracı kuralları birer testtir (yetkisiz → 403, başka ofis → 404, mükellefin müşavir hesabını kullanması → red); her kiracı tablosunun RLS'i pgTAP ile; kurum sonucu şemayla doğrulanır (fail-closed) |
| Korkusuz değişiklik | `pnpm verify` (tip, mimari, birim), yığın testleri (entegrasyon + pgTAP + pytest), dört ekranda kabul testleri; kapsam eşiği düşürülmez (§6.3) |
| Kodun tasarımını iyileştirir | Test edilebilirlik tasarımı biçimlendirir: use-case bağımlılıkları port olarak alır (in-memory sahte ile test edilir), yetki `can` fonksiyonu olarak gelir, zaman parametre ya da `Clock` ile gelir. Bunlar [ddd.md](ddd.md)'deki katman kurallarının testteki karşılığıdır |
| Canlı dokümantasyon | Türkçe test adları kuralı anlatır; bağlam sayfasının "Testler" bölümü test dosyalarını listeler; [ozellik-durumu.md](../ozellik-durumu.md) hangi işlemin tamamlandığını testlerden üretir |

## 4. Örnekler

### 4.1 Küçük döngü: bir domain kuralı

Giriş belgesindeki `Topla` örneğinin karşılığı. Kural: "son tarihi geçmiş açık görev gecikmiştir" (`isOverdue`, [task.ts](../../packages/contexts/workspace/src/domain/task.ts)). Aşağıdaki adımlar, kodun bugünkü hâline nasıl varılabileceğini gösterir.

**Döngü 1. Kırmızı:**

```ts
it('son tarihi geçmiş görev gecikmiştir', () => {
  expect(isOverdue({ status: 'Bekliyor', dueOn: '2026-10-01' }, '2026-10-25')).toBe(true);
});
```

**Yeşil**, en az kodla:

```ts
export const isOverdue = (t: { status: TaskStatus; dueOn: string }, today: string) => t.dueOn < today;
```

**Döngü 2. Kırmızı:** Yeni davranış, yeni test. Bu test yukarıdaki kodla düşer:

```ts
it('tamamlanmış görev gecikmiş sayılmaz', () => {
  expect(isOverdue({ status: 'Tamamlandı', dueOn: '2020-01-01' }, '2026-10-25')).toBe(false);
});
```

**Yeşil:** `t.status !== 'Tamamlandı' && t.dueOn < today`.

**Düzenleme:** Sabit metin adlandırılır (`DONE`) ve sayaçlarla (`taskCounters`) paylaşılır. Bugün `today` parametre olarak gelir, saat okunmaz; bu yüzden test sabit tarihle yazılabilir. İki test de yeşil kalır.

### 4.2 Özellik düzeyi: kayıttan yeşile

Örnek: görev atama (`gorevler.assign`).

**Adım 1. Kayıt.** Anahtarı ağaca ekle. Modül/sayfa/işlem yardımcıları vardır:

```ts
...mod('gorevler', 'Görevler', 'workspace', 'portal',
  actions('gorevler', { view: 'Görüntüle', create: 'Oluştur', assign: 'Ata', close: 'Kapat' }, 'portal'),
```

`pnpm features` artık bu düğümü 🔴 gösterir.

**Adım 2. Kırmızı kabul testi.** Kullanıcı gözünden, Türkçe adlı, etiketli bir Playwright senaryosu yaz ([calisma-alani.e2e.ts](../../apps/web/e2e/calisma-alani.e2e.ts)):

```ts
test('@F:gorevler.assign yönetici görevi personele atar, personel kendi listesinde görür', async ({ browser }) => {
  const o = await ofisAc(true);              // her test kendi ofisini açar — testler birbirinden bağımsız
  const yonetici = await (await browser.newContext()).newPage();
  const hatalar = hataTopla(yonetici);       // konsol/sayfa hatası testi düşürür
  await girisYap(yonetici, o.yonetici);
  // … erişilebilir seçicilerle (getByLabel, getByRole) kullanıcı adımları
  await tasmaYok(yonetici);                  // dört ekran sınıfında yatay taşma yok
  expect(hatalar).toEqual([]);
});
```

Çalıştır, **kırmızı olduğunu gör** (doğru sebepten: ekran/uç henüz yok).

**Adım 3. İçten dışa döngüler.** Her satır, §2'deki döngünün bir ya da birkaç turudur:

| Sıra | Test | Neyi kanıtlar |
|---|---|---|
| 1 | Domain | Saf kural: `statusPermission('Tamamlandı', 'Bekliyor') === 'gorevler.close'` |
| 2 | Application | Akış ve hata kodları: başkasına atamak `gorevler.assign` ister → `yetki_yok`; ofis dışı kişi → `uye_degil` |
| 3 | pgTAP | Tablo, PK `(org_id, id)`, RLS: başka ofis/kapsam dışı kayıt görünmez |
| 4 | Entegrasyon | Gerçek Postgres + RLS + denetim kaydı: personel kapsam dışı görevi göremez, atama `audit`'e yazılır |
| 5 | BFF / UI | Uç doğru durum kodlarını döner; ekran çalışır (bugün kabul testiyle kapsanıyor, §6.1) |

**Adım 4. Yeşil ve düzenleme.** Kabul testi geçince `pnpm features`'ı test sonuçlarıyla çalıştır; düğüm 🟢 olur. Düzenleme boyunca testler yeşil kalır.

**Adım 5. Bitir.** `pnpm verify` yeşil; arayüz değiştiyse kabul testleri dört ekranda (`node tools/deploy/yigin.mjs e2e`); bağlam sayfasının "Testler" bölümü güncel.

## 5. Zorlayıcı durumlar ve projedeki karşılıkları

[tdd-nedir §5](tdd-nedir.md#5-tdd-ne-zaman-kullanılmalı) TDD'nin bazı işlerde süreci yavaşlatabileceğini söyler. Eworks'te TDD isteğe bağlı değildir (D22, testsiz kod yok); bu durumlar şöyle karşılanır:

### 5.1 Arayüz ağırlıklı iş

- Görsel ayrıntı test edilmez; **kullanıcının yaptığı iş** test edilir: kabul testi erişilebilir adlarla (`getByLabel`, `getByRole`) form doldurur, sonucu durum mesajından ve tablodan okur.
- Yerleşim kuralları ortak yardımcılarla tek satırda denetlenir: dört ekran sınıfında yatay taşma ve WCAG 2.1 A/AA ciddi/kritik erişilebilirlik ihlali yok (`ekranDenetle`, axe-core), konsol hatası yok (`hataTopla`). Otomatik tarama orta/küçük etkili ihlalleri ve klavye akışını garanti etmez; onlar UX kontrol listesindedir.
- Ekrandaki karar mantığı (gecikme, sayaç, yetkiye göre gösterim) bileşene değil domain'e konur; orada birim testiyle hızlı döner.

### 5.2 Dış bağımlılık: kurum (GİB/SGK)

- Testte gerçek kuruma gidilmez. Python ACL ve kabul testleri **sahte kurum sunucusuna** karşı koşar (`services/integration/tests/sahte_kurumlar`); `*.gib.gov.tr` yönlendirmesi yalnız test/demo ortamındadır.
- Sahte sunucu kurumun **doğrulanmış** davranışını taklit eder; bilinmeyen davranış uydurulmaz, açık konuya yazılır.
- Kurumla konuşan işlem (`live: true`; bugün `firmalar.gib_sozlesmeler.sync`, `beyanname.senkron.start`, `sgk.ebildirge.sync`) sahte GİB'e karşı tüm testleri geçse de kırmızı kalır. Yeşil için canlı koşu yapılır ve sonucu [canli-dogrulamalar.json](../../packages/feature-registry/canli-dogrulamalar.json)'a kaydedilir (anahtar, tarih, kim, sonuç, sürüm). Kayıtta kişisel veri ve kurum çıktısı yer almaz; yalnız sayılar. Ayrıntı: [canli-dogrulama.md](canli-dogrulama.md).

### 5.3 Netleşmemiş iş ve keşif

- Kural belirsizse test yazılamaz; bu bir eksikliktir, kodla kapatılmaz. Varsayım yapılmaz: açık konuya yazılır ve sorulur ([kurallar](../ai/kurallar.md#kararlar-ve-belgeler-nasıl-işlenir)).
- Kurum ekranını ya da bir kütüphaneyi tanımak için deneme kodu yazılabilir. "Testsiz kod yok" kuralı gereği bu kod olduğu gibi birleştirilmez; öğrenilen davranış önce teste dönüşür, kod döngüyle yeniden yazılır.
- İşlem kayıtta kırmızı durabilir. Geliştirme kipinde kırmızı görünmek (D39) eksik işi gizlemekten iyidir.

## 6. Başvuru

### 6.1 Test katmanları: nereye, nasıl

| Katman | Dosya kalıbı | Koşucu | Bağımlılık | Örnek |
|---|---|---|---|---|
| Domain | `packages/contexts/<ctx>/test/domain/*.test.ts` | `pnpm test` | yok | [declaration.test.ts](../../packages/contexts/tax-filing/test/domain/declaration.test.ts) |
| Application | `…/test/application/*.test.ts` | `pnpm test` | in-memory port, sahte saat | [workspace.test.ts](../../packages/contexts/workspace/test/application/workspace.test.ts) |
| Entegrasyon | `…/test/infrastructure/*.int.test.ts` | `yigin.mjs test` | gerçek Postgres/Redis/RabbitMQ/S3/GoTrue | [workspace.int.test.ts](../../packages/contexts/workspace/test/infrastructure/workspace.int.test.ts) |
| Veritabanı | `supabase/tests/{control,tenant}/<şema>/*.sql` | `yigin.mjs test` | gerçek Postgres | [portfolio/kapsam.sql](../../supabase/tests/tenant/portfolio/kapsam.sql) |
| İşçi | `apps/worker/test/*.test.ts` | `pnpm test` | in-memory | [uygulayici.test.ts](../../apps/worker/test/uygulayici.test.ts) |
| Yetki anahtarı bildirimi | rota taraması | `pnpm test` | yok | [yetki-anahtarlari.test.ts](../../apps/web/src/bff/yetki-anahtarlari.test.ts) |
| Kabul | `apps/web/e2e/*.e2e.ts` | `yigin.mjs e2e` | çalışan yığın, sahte GİB | [firmalar.e2e.ts](../../apps/web/e2e/firmalar.e2e.ts) |
| ACL (Python) | `services/integration/tests/test_*.py` | pytest (yığın testinde) | sahte kurum sunucusu | [test_beyanname.py](../../services/integration/tests/test_beyanname.py) |

Birim ve entegrasyon ayrımı dosya adıyla yapılır: `*.int.test.ts` yalnız yığının ağında koşar ([vitest.config.ts](../../vitest.config.ts)). BFF ucu ve UI bileşeni için ayrı test henüz yoktur; ilk yazan `apps/web/src/app/api/<ctx>/…/*.test.ts` ve `apps/web/src/features/<ctx>/test/` kalıbını kullanır.

#### Domain testi

Girdi → çıktı; kurulum yok, milisaniyeler sürer. Sınır değerleri ve geçersiz girdiyi açıkça yaz (`'2026-02-30'`, 121 karakter başlık). Zaman parametre olarak verilir (`isOverdue(t, '2026-10-25')`), testte gerçek saat okunmaz.

#### Application testi: in-memory portlar

Port arayüzünü test dosyasında küçük bir `Map` ile uygula; mock kütüphanesi kullanılmaz. Sahte depo, gerçek adaptörün **sözleşmesini** taklit eder (iyimser kilit dahil):

```ts
function depo(baslangic: Task[] = []) {
  const g = new Map(baslangic.map((t) => [t.id, t]));
  const r: TaskRepository = {
    get: async (_c, id) => g.get(id) ?? null,
    update: async (_c, id, v, p) => {
      const t = g.get(id);
      if (!t) return 'bulunamadi';
      if (t.version !== v) return 'catisma';
      g.set(id, { ...t, ...p, version: v + 1 });
      return 'ok';
    },
    // …
  };
  return { r, g };
}
const hepsi = () => true;
const yalniz = (...k: string[]) => (key: string) => k.includes(key);   // yetki: yalnız verilen anahtarlar
```

Her hata kodu en az bir testte görünür: `expect(await createTask(ctx, …, yalniz('gorevler.create'), d)).toEqual({ ok: false, error: 'yetki_yok' })`. Mutlu yolda yalnız `ok` değil, **yan etki** de doğrulanır (`g.get('t-1')?.assigneeId`).

#### Entegrasyon testi: gerçek yığın

- Bağlantılar `yigin` yardımcısından gelir (`yigin.controlUrl()`, `yigin.shardUrls('eworks_app')`); web rolü (`eworks_app`) RLS'e tabidir, sistem rolü (`eworks_worker`) kurulum içindir.
- Her test **kendi ofisini açar** (`openOffice`, `addMember`) ve rastgele adlar kullanır; testler sıra ve paylaşılan veriye bağımlı olmaz.
- Mutlaka yazılacak senaryolar: kapsam dışı kayıt görünmez, başka ofis → `bulunamadi` (404), ofis dışı kişiye işlem → red, denetim kaydı yazıldı.

#### pgTAP

`select plan(n)` … `select * from finish()`. Kurulum verisini süper kullanıcıyla ekle, sonra `set local role authenticated` ve `request.jwt.claims` ile kullanıcıya geç; görünürlüğü `is(count, …)`, yasakları `throws_ok(…, '42501')` ile doğrula. Her yeni kiracı tablosu için: RLS açık, başka ofis görmez, kapsam dışı görmez.

#### Kabul testi

- Seçiciler erişilebilir adlarla (`getByLabel('Görev başlığı')`, `getByRole('button', { name: 'Görevi kaydet' })`); CSS sınıfı yalnız başka yol yoksa.
- Yardımcılar: `ofisAc(personelle)`, `girisYap`, `hataTopla`, `tasmaYok`, `menuyuAc` ([yardim.ts](../../apps/web/e2e/yardim.ts), [genel-kurulum.ts](../../apps/web/e2e/genel-kurulum.ts)).
- Dört ekran sınıfında koşar (telefon 375, tablet 768, laptop 1366, geniş 1920; [playwright.config.ts](../../apps/web/playwright.config.ts)).
- Ağ yanıtını beklemek gerekiyorsa `Promise.all([page.waitForResponse(…), eylem])`; `waitForTimeout` kullanılmaz.

#### Python ACL

Ayrıştırıcılar sahte kurum sunucusunun HTML/SOAP fikstürleriyle (`tests/sahte_kurumlar`) test edilir; çıktı `contracts/` şemasına karşı doğrulanır. Özelliğe bağlama: `@pytest.mark.feature("beyanname.senkron.start")`. Fikstürde gerçek mükellef/VKN yok.

### 6.2 Testi özelliğe bağlamak (etiket)

```ts
test('@F:gorevler.create @F:gorevler.assign …', …)          // Playwright / Vitest test adı
describe('[F:firmalar.kart.create] firma kartı', …)           // Vitest describe
```

- Bir test birden çok etiket taşıyabilir; etiketler test adında ya da `describe` adında olur, JUnit çıktısından okunur ([uret.ts](../../tools/features/uret.ts)).
- **Etiketi yalnız o özelliği gerçekten doğrulayan teste koy.** Altyapı, kayıt ya da yardımcı testine etiket koymak özelliği haksız yeşile çevirir.
- `skip`, `todo`, `fixme` başarısız sayılır: atlanan test düğümü kırmızı tutar. Bu bilinçlidir; testi atlamak "bitti" demek değildir.
- Bilinmeyen etiket (kayıtta olmayan anahtar) üretici çıktısında raporlanır; yazım hatasını kontrol et.

### 6.3 Değişmez kurallar

- **Kapsam eşiği düşürülmez:** bağlamların `domain` + `application` katmanı ve `packages/kernel` için %90 satır / %80 dal ([vitest.config.ts](../../vitest.config.ts)); `pnpm test:kapsam`, `pnpm verify` ve CI zorlar. Altyapı adaptörleri birim kapsamına girmez, yığında test edilir. ACL ayrıştırıcıları %90.
- **Yetki anahtarı:** her sayfa `sayfaIzni`, her uç işleyicisi `apiIzni` (ya da `eBeyannameIsi`) ile kayıttaki bir anahtarı bildirir; [yetki-anahtarlari.test.ts](../../apps/web/src/bff/yetki-anahtarlari.test.ts) denetler. Herkese açık rota yalnız gerekçesiyle oradaki listeye girer.
- **Gerçek kişisel veri fikstüre girmez:** `fakeVkn()`, `fakeTckn()` (99 önekli), tekrarlanabilirlik için `seededRandom(seed)` ([@eworks/testing](../../packages/testing/src/index.ts)).
- Testte gerçek saat, gerçek kurum, sabit bekleme yok; ağ yalnız yığın ve sahte kurum sunucusu.
- Güvenlik senaryoları birer testtir: yetkisiz → 403, başka ofisin kaydı → 404, mükellefin müşavir hesabını kullanma girişimi → red, CSRF'siz değişiklik → 403.
- Kırmızı testi yeşile çevirmek için testi zayıflatma (§2.2).

### 6.4 Komutlar

| Komut | Ne yapar |
|---|---|
| `pnpm test` / `pnpm test:watch` | Birim testleri (bağımlılıksız); döngü sırasında `test:watch` |
| `pnpm test:kapsam` | Birim testleri + kapsam eşiği (özet ve rapor `test-results/kapsam/`) |
| `node tools/deploy/yigin.mjs test` | Birim + `*.int.test.ts` + pgTAP + pytest, yığının ağında; JUnit `test-results/` |
| `node tools/deploy/yigin.mjs e2e` | Playwright kabul testleri, dört ekran; `test-results/e2e.xml` |
| `pnpm features` | `test-results/`'tan özellik durumunu üretir: `feature-status.json`, [ozellik-durumu.md](../ozellik-durumu.md), README özeti |
| `pnpm verify` | Tip, mimari, birim + kapsam eşiği, yetki anahtarı denetimi, hafıza, ajan senkronu, belge bağlantıları; iş bitmeden yeşil olmalı |

Yerel Node 24 değilse aynı komutlar `node:24` container'ında koşar (`sh tools/deploy/dogrula.sh`).

<!-- gezinti — node tools/docs/gezinti.mjs --yaz üretir, elle düzenlemeyin -->

---

[README](../../README.md) › [Genel bakış](../00-genel-bakis.md) › **TDD rehberi**
<!-- /gezinti -->
