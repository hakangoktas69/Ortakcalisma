<!-- gezinti — node tools/docs/gezinti.mjs --yaz üretir, elle düzenlemeyin -->
[README](../../README.md) › [Genel bakış](../00-genel-bakis.md) › **DDD rehberi**
<!-- /gezinti -->

# DDD uygulama rehberi

> DDD'ye yeniyseniz önce: [DDD nedir, ne işe yarar?](ddd-nedir.md) — domain, ortak dil, bounded context, entity, value object, aggregate, repository kavramları.
> Hedef ve gerekçe: [hedef-mimari/06](../hedef-mimari/06-kaynak-kod-yapisi-ddd-tdd.md) (D20–D22). Bu sayfa **bugünkü koddaki** karşılıkları anlatır: yeni kod yazarken hangi kavram nereye düşer, bağlamlar nasıl konuşur, nelerden kaçınılır.
> Kısa kurallar: [ai/mimari.md](../ai/mimari.md), [ai/kurallar.md](../ai/kurallar.md). TDD tarafı: [tdd.md](tdd.md).

Sayfa, [ddd-nedir.md](ddd-nedir.md)'deki kavram hiyerarşisini izler: önce **stratejik tasarım** (§2, büyük resim), sonra **taktiksel tasarım** (§3, kod seviyesi), en son bu kavramları taşıyan **uygulama mimarisi** (§4: katmanlar, public API, BFF). Örnekler çoğunlukla `workspace` bağlamından (görevler) alınmıştır: küçük, tüm katmanları olan ve uçtan uca testli bir bağlamdır.

## 1. Kavram haritası

"Ek" işaretli kavramlar giriş belgesinde yoktur; Evans'ın DDD'sinin tamamlayıcı kavramlarıdır ve bu depoda kullanılır.

| | Kavram | Eworks'te | Bölüm |
|---|---|---|---|
| **A. Stratejik** | Domain (alan) | Mali müşavirlik: GİB beyanname, SGK bildirimleri, mükellef portföyü | [§2.1](#21-domain-ve-alt-alanlar) |
| | Alan uzmanı | Mali müşavir ve ofis personeli; kurum davranışında kurum belgesi ve canlı doğrulama | [§2.2](#22-alan-uzmanı) |
| | Ortak dil | Arayüz Türkçe, tanımlayıcı İngilizce, tek sözlük | [§2.3](#23-ortak-dil) |
| | Bounded context | `packages/contexts/<ctx>` + aynı adlı Postgres şeması + ekranlar + bağlam sayfası | [§2.4](#24-bounded-context) |
| | Bağlam ilişkileri *(ek)* | Paylaşılan çekirdek, anti-corruption layer, yayımlanmış dil, olaylar | [§2.5](#25-bağlamlar-arası-ilişkiler) |
| **B. Taktiksel** | Entity (varlık) | Kimliği `(org_id, id)` olan kayıt: `Task`, `Note`, `Firm` | [§3.1](#31-entity-varlık) |
| | Value object (değer nesnesi) | `TaxId`, `Period`, `TaskStatus` | [§3.2](#32-value-object-değer-nesnesi) |
| | Aggregate ve aggregate root | `Task` (iyimser kilitli tutarlılık sınırı), `Declaration` | [§3.3](#33-aggregate-ve-aggregate-root) |
| | Repository (depo) | Application'da port (`TaskRepository`), infrastructure'da `PgTaskRepository` | [§3.4](#34-repository-depo) |
| | Alan olayı *(ek)* | `DomainEvent` zarfı, `contracts/events/`, transactional outbox | [§3.5](#35-alan-olayı-ek) |
| | Uygulama servisi *(ek)* | Use-case fonksiyonları: `createTask`, `changeStatus` | [§3.6](#36-uygulama-servisi--use-case-ek) |
| **C. Uygulama mimarisi** | Katmanlar, port–adaptör | `domain` ← `application` ← `infrastructure` / UI; `pnpm arch` | [§4.1](#41-katmanlar-ve-bağımlılık-yönü) |
| | Public API | `src/index.ts` | [§4.2](#42-public-api--srcindexts) |
| | Bileşim kökü | `apps/web/src/bff/konteyner.ts`, `apps/worker/src/uygulayici.ts` | [§4.3](#43-bileşim-kökü) |
| | BFF ve UI | İnce kabuk: yetki, doğrulama, eşleme | [§4.4](#44-bff-ve-ui--ince-kabuk) |

## 2. Stratejik tasarım

### 2.1 Domain ve alt alanlar

Domain, mali müşavir ofislerinin kurum (GİB, SGK) verisini toplu çekip kontrol, görev ve uyarıya çevirmesidir ([ai/vizyon.md](../ai/vizyon.md)). Domain üç tür alt alana bölünür ([06 §2](../hedef-mimari/06-kaynak-kod-yapisi-ddd-tdd.md#2-bounded-context-haritası-ve-ortak-dil)); yatırım ve titizlik buna göre dağıtılır:

| Alt alan | Bağlamlar | Anlamı |
|---|---|---|
| Çekirdek | `tax-filing`, `social-security`, `portfolio` | Ürünü ayırt eden iş kuralları; en zengin model, en sıkı test |
| Destekleyici | `credentials`, `sync`, `documents`, `workspace` | Çekirdeğe hizmet eden, bu işe özgü ama ayırt edici olmayan kurallar |
| Genel | `identity-access`, `organization`, `notifications`, `audit`, `sales` | Her SaaS'ta benzeri olan işler; sade tutulur |

### 2.2 Alan uzmanı

- İş kuralının kaynağı **mali müşavir ve ofis personelidir**; kodda kural yazarken kaynağı yorumda belirtin. Örnek: [declaration.ts](../../packages/contexts/tax-filing/src/domain/declaration.ts) kabul kuralının eski portaldaki kaynağını ve gerekçesini yazar.
- Kurum davranışı (GİB/SGK ekranı, servis yanıtı) için alan uzmanı kurumun kendisidir: **doğrulanmamış kurum davranışı doğrulanmış gibi yazılmaz**. Sahte kurum sunucusuyla geçen işlem canlı doğrulama kaydı ister (D33, [canli-dogrulama.md](canli-dogrulama.md)).
- Kural belirsizse varsayım yapılmaz: açık konuya yazılır ve sorulur ([kurallar](../ai/kurallar.md#kararlar-ve-belgeler-nasıl-işlenir)).

### 2.3 Ortak dil

- Arayüz, belge ve konuşma **Türkçe**, kod tanımlayıcıları **İngilizce**. İkisi arasındaki eşleme bire bir ve sabittir; tek sözlük: [ai/mimari.md](../ai/mimari.md#ortak-dil-tr--kod) (Mükellef → `Taxpayer`, Görev → `Task`). **Yeni terim önce sözlüğe, sonra koda girer.**
- Kural adları ortak dildeki ifadeyi yansıtır: `isOverdue` ("gecikmiş"), `statusPermission` ("tamamlamak ve yeniden açmak kapat yetkisidir").
- Kullanıcıya ve iş birimine görünen her şey Türkçedir: hata kodları (`yetki_yok`, `catisma`, `bulunamadi`), doğrulama mesajları, test adları (`'eski sürümle güncelleme çatışmadır'`), yetki anahtarları (`gorevler.close`).

### 2.4 Bounded context

Bir bağlam her katmanda **aynı adla** görünür:

| Yer | `workspace` örneği |
|---|---|
| Alan paketi | `packages/contexts/workspace` (`@eworks/workspace`) |
| Postgres şeması | `workspace` (`workspace.tasks`, `workspace.notes`) |
| Ekranlar ve BFF | `apps/web/src/features/workspace`, `/api/gorevler` |
| Bağlam sayfası | [docs/baglamlar/workspace.md](../baglamlar/workspace.md) |

- Sorumluluklar: [ai/mimari.md](../ai/mimari.md#bounded-contextler). Yeni iş iki bağlama da uyuyorsa sorulur, varsayılmaz.
- Aynı kelime bağlama göre farklı model taşır: mükellef `portfolio`'da tam kart (`Firm`: unvan, VKN, müşavir, arşiv); `tax-filing`'de yalnız beyanname eşlemesi için gereken kadar, kendi port tipiyle (`FirmPort`). Bir bağlam diğerinin modelini ödünç almaz.
- **Yeni bağlam** mimari karardır: önce `D-NN`/`K-NN` ([kurallar](../ai/kurallar.md#kararlar-ve-belgeler-nasıl-işlenir)). Sonra iskelet (§4.1), `package.json` adı `@eworks/<ctx>`, Postgres şeması, `feature-registry`'de modüllerin `context` alanı, `docs/baglamlar/<ctx>.md` ve [baglamlar/README.md](../baglamlar/README.md) tablosu.

### 2.5 Bağlamlar arası ilişkiler

| İlişki | Ne zaman | Bu depoda |
|---|---|---|
| Paylaşılan çekirdek | Birçok bağlamın aynı kuralla kullandığı saf, kararlı değer | `packages/kernel`: `TaxId`, `Period`, `Result`, `Clock`, `DomainEvent`. Kernel'e eklemek ortak karardır |
| Port + public API | A, B'nin bilgisine senkron ihtiyaç duyar | A'da port (`MemberPort.isStaff`); bileşim kökünde B'nin public API'siyle doldurulur (identity-access `PgMembershipReader.staff`). **Tercih edilen yol**: A, B'yi tanımadan test edilir. Gerekirse application katmanı B'nin `index.ts`'inden doğrudan fonksiyon da çağırabilir |
| Olay (outbox) | A olunca B tepki verir | A, değişiklikle aynı işlemde outbox'a yazar; işçi RabbitMQ'ya taşır; tüketici B'nin application katmanını çağırır. Yük şeması `contracts/events/*.v1.schema.json` |
| Anti-corruption layer + yayımlanmış dil | Kurum verisi | Python ACL (`services/integration`) ham veriyi `contracts/integration/*.schema.json` diline çevirir; `apps/worker` şemayı doğrular (fail-closed) ve bağlam use-case'lerini çağırır (`importDeclarations`, `importFilings`, `registerDocuments`). **Python tablolara yazmaz, alan kuralı içermez** |

Yasak: başka bağlamın tablosuna sorgu ya da yazma, başka bağlamın iç dosyasını import, Python'da alan kuralı (ör. son gün hesabı), bağlamlar arası "ortak" `shared` paketi. Sınırlar araçla zorlanır (§4.1); Python tarafında `uv run lint-imports` kurumların (`gib`, `sgk`) birbirinden bağımsızlığını denetler ([pyproject.toml](../../services/integration/pyproject.toml)).

## 3. Taktiksel tasarım

Bu depoda taktiksel yapılar **sınıf değil, salt okunur tip + saf fonksiyon** olarak yazılır. Kavramlar aynıdır; yalnız ifade biçimi işlevseldir.

### 3.1 Entity (varlık)

- Kimliği olan, zamanla değişen kayıttır. Kimlik kiracı içinde tanımlıdır: veritabanında PK `(org_id, id)`, kodda `id` (UUID) + `Ctx.org`.
- Kimlik altyapıda ya da bağımlılıkla üretilir (`newId`); domain `randomUUID()` çağırmaz.
- Değişen entity `version` taşır (iyimser kilit, §3.3). Örnek: `Task` = `{ id, title, firmId, dueOn, status, assigneeId, createdBy, createdAt, version }`.

### 3.2 Value object (değer nesnesi)

- Kimliği yoktur, değeriyle eşittir, **salt okunurdur** (`readonly`), oluşturulurken doğrulanır. Geçersiz değer hiç oluşmaz: ayrıştırıcı `Result` döner.

```ts
export type TaxId = { readonly kind: 'VKN' | 'TCKN'; readonly value: string };
export function parseTaxId(input: string): Result<TaxId, 'gecersiz_vergi_kimligi'>;   // kernel/tax-id.ts
export type Period = { readonly kind: 'month'; readonly year: number; readonly month: number } | …;   // kernel/period.ts
```

- Değer nesnesine ait davranış onunla birlikte durur: `maskTaxId` (ekranda son 4 hane), `formatPeriod`.
- Sabit küme `as const` dizi + türetilmiş tip; `enum` kullanılmaz (`erasableSyntaxOnly`):

```ts
export const TASK_STATUSES = ['Bekliyor', 'Devam Ediyor', 'Öncelikli', 'Tamamlandı'] as const;
export type TaskStatus = (typeof TASK_STATUSES)[number];
```

- Birçok bağlamın kullandığı değer nesnesi `packages/kernel`'e, yalnız bir bağlamınki o bağlamın `domain`'ine konur.

### 3.3 Aggregate ve aggregate root

- Aggregate **tutarlılık sınırıdır**: bir işlem tek aggregate'i değiştirir; kökü dışarıdan erişimin tek kapısıdır. Bağlamların aggregate kökleri: [06 §2](../hedef-mimari/06-kaynak-kod-yapisi-ddd-tdd.md#2-bounded-context-haritası-ve-ortak-dil) tablosu.
- Örnek, `Task`: durum yalnız `changeStatus` ile, sorumlu yalnız `assignTask` ile değişir. Eşzamanlı değişikliği `version` korur; eski sürümle güncelleme `catisma` (HTTP 409) olur.
- `Note` ayrı bir aggregate'tir ve yalnız eklenir (değiştirilmez, silinmez). Görevle notu tek işlemde değiştiren bir use-case yazılmaz.
- Başka aggregate'e **kimlikle** başvurulur, nesneyle değil: `Task.firmId`, `Task.assigneeId`. Başka bağlamdaki kaydın varlığı port ile denetlenir (`MemberPort.isStaff`).
- Değişmezler (invariant) domain'de adlandırılmış saf fonksiyonlardır ve alan bazlı hata listesi döner; mesaj sabit Türkçe metindir:

```ts
if (!title || title.length > 120) errors.push({ field: 'title', message: 'Görev başlığı 1–120 karakter olmalı.' });
```

- Domain **G/Ç yapmaz**: veritabanı, Redis, `process.env`, `Date.now()`, `Math.random()` yok. Zaman parametre (`today: string`) ya da `Clock` portu ile gelir.
- Daha zengin örnek, `Declaration` ([declaration.ts](../../packages/contexts/tax-filing/src/domain/declaration.ts)): beyanname yalnız aynı oturumda okunan listede geçerli "Aracılık ve Sorumluluk" sözleşmesi olan mükellef için kabul edilir (`hasSameSessionAccess`); doğrulanmayan sorgu atlanır, diğerleri uygulanır.

### 3.4 Repository (depo)

- **Aggregate kökü başına bir repository.** Arayüzü (port) `application` katmanında, use-case'in ihtiyacı kadar tanımlanır; uygulaması `infrastructure`'dadır. `application` `infrastructure`'ı import etmez.
- Dönüşler alan diliyle konuşur: `TaskRepository.update` → `'ok' | 'catisma' | 'bulunamadi'`.
- Adaptör `Pg<Ad>Repository`'dir: `ShardRouter.poolFor(org)` ile doğru shard'a, `withUser(pool, { sub, org }, fn)` ile kullanıcının JWT claim'leriyle tek işlemde bağlanır, böylece RLS etkin olur (D34).
- Sorgu yalnız **kendi şemasına** gider ve SQL'de de `org_id` ile filtreler; RLS ikinci savunmadır. Görünmeyen kayıt `bulunamadi` döner (başka ofis → 404).
- Denetim kaydı gerektiren değişiklik (atama, kapatma, kurum şifresi okuma) aynı `fn` içinde `audit.record(...)` ile, **değişiklikle aynı veritabanı işleminde** yazılır. Varlığı entegrasyon testiyle doğrulanır.

### 3.5 Alan olayı *(ek)*

- Ortak zarf `DomainEvent<TName, TPayload>` (`name`, `orgId`, `occurredAt`, `payload`); yük şeması `contracts/events/` altında sürümlü (`sync.is_istendi.v1`).
- Olay, değişiklikle **aynı işlemde** outbox'a yazılır (transactional outbox); yayımlamayı işçi yapar.
- Yükte kişisel veri yok: kimlik (ID) taşınır, ayrıntıyı tüketici kendi yetkisiyle okur.

### 3.6 Uygulama servisi / use-case *(ek)*

Use-case aggregate'i yükler, domain kuralını uygular, repository ile kaydeder. Düz bir `async function`'dır ve imzası sabit bir kalıp izler:

```ts
export async function changeStatus(
  ctx: Ctx,                         // { sub, org } — kim, hangi ofis (kiracı)
  id: string, version: number, to: string,
  can: Can,                         // (key) => boolean — etkin yetki, BFF'ten gelir
  d: { tasks: TaskRepository },     // bağımlılıklar: yalnız portlar
): Promise<Result<{ id: string }, TaskError>>
```

- **Beklenen hata istisna değil, `Result` değeridir** (`ok(...)` / `err('yetki_yok')`). Hata kodları bağlamın birleşim tipidir (`TaskError = 'gecersiz' | 'yetki_yok' | 'bulunamadi' | 'catisma' | 'uye_degil'`); HTTP durumu ve kullanıcı metni BFF'te eşlenir. Beklenmeyen hata (DB koptu) fırlar.
- Yetki: sayfa/uç düzeyindeki anahtar BFF'te denetlenir; **iş kuralına bağlı yetki seçimi** use-case'tedir (duruma göre `gorevler.close` ya da `gorevler.create`). Kapsam (hangi firmayı görür) RLS'tedir; use-case bunu tekrar etmez.
- Zaman ve kimlik bağımlılık olarak gelir (`Clock`, `newId`); testte sabittir.

## 4. Uygulama mimarisi: kavramları taşıyan katmanlar

### 4.1 Katmanlar ve bağımlılık yönü

```
packages/contexts/<ctx>/
├─ src/domain/           entity, value object, aggregate kuralları — yalnız kendi domain'i ve @eworks/kernel
├─ src/application/      use-case + repository/port arayüzleri — domain'i ve başka bağlamların index.ts'ini kullanır
├─ src/infrastructure/   repository uygulamaları (Postgres) — @eworks/platform kullanabilir
├─ src/index.ts          PUBLIC API: dışarıya ne açılıyorsa yalnız burada
└─ test/{domain,application,infrastructure}/
```

Bağımlılık yönü içe doğrudur: `domain` ← `application` ← `infrastructure` / UI. Kurallar [dependency-cruiser.cjs](../../tools/arch/dependency-cruiser.cjs) ile zorlanır, `pnpm arch` yeşil olmadan iş bitmez:

| Kural adı | Neyi korur | Ne yasaklar |
|---|---|---|
| `baglam-yalniz-index-uzerinden` | Bounded context sınırı | Başka bağlamın `src/index.ts` dışındaki bir dosyasını import etmek |
| `uygulamalar-baglama-index-uzerinden` | Bounded context sınırı | `apps/*`'ın bağlam iç dosyalarına erişmesi |
| `domain-saf-kalir` | Taktiksel model | `domain`'in kernel ve kendi domain'i dışında bir şeye (tip dışı) bağımlı olması |
| `application-altyapiyi-kullanmaz` | Repository port–adaptör ayrımı | `application`'ın `infrastructure`'ı import etmesi |
| `kernel-saf-kalir`, `platform-alan-bilgisi-icermez` | Paylaşılan çekirdek | Çekirdeğin dışa, platformun bağlamlara bağımlı olması |
| `ui-altyapiya-erisemez`, `ui-baska-ozellige-erisemez` | Sunum katmanı | `features/<ctx>`'in platform/altyapıya ya da başka bağlamın `features`'ına erişmesi |
| `dongusel-bagimlilik` | Genel | Döngüsel import |

### 4.2 Public API — `src/index.ts`

- Dışarıya açılan her şey burada **adıyla** dışa aktarılır (`export *` yok): use-case'ler, portlar, dış tüketicinin ihtiyaç duyduğu domain fonksiyonları, adaptör sınıfları (bileşim kökü için), olay tipleri.
- Dosyanın başında bağlamın sorumluluğunu tek satırda söyleyen yorum ve `CONTEXT` sabiti bulunur ([workspace/src/index.ts](../../packages/contexts/workspace/src/index.ts)).
- `index.ts`'ten çıkan her şey sözleşmedir: kaldırmak/yeniden adlandırmak tüm tüketicileri etkiler.

### 4.3 Bileşim kökü

Port ↔ adaptör bağlantısı yalnız uygulamada kurulur; bağlamlar birbirini burada tanır:

- BFF: [konteyner.ts](../../apps/web/src/bff/konteyner.ts) — süreç başına tek örnek, yapılandırma açılışta doğrulanır.
- İşçi: [uygulayici.ts](../../apps/worker/src/uygulayici.ts) — entegrasyon sonucunu şemayla doğrulayıp bağlam use-case'lerine dağıtır.

### 4.4 BFF ve UI — ince kabuk

BFF ucu iş kuralı içermez; sırası hep aynıdır ([durum/route.ts](../../apps/web/src/app/api/gorevler/%5Bid%5D/durum/route.ts)):

1. `apiIzni(req, '<yetki.anahtari>', degisiklik)` — oturum, aynı kaynak, CSRF, yetki anahtarı (kural 7: tek anahtar). Sayfada karşılığı `sayfaIzni('<anahtar>')`. Anahtarın bildirildiğini ve kayıtta olduğunu [yetki-anahtarlari.test.ts](../../apps/web/src/bff/yetki-anahtarlari.test.ts) denetler.
2. Gövdeyi sınırlı boyutta oku (`jsonGovde`), şekil doğrula → bozuksa `400`.
3. Use-case'i `baglam(s)`, `can` ve `konteyner()` bağımlılıklarıyla çağır.
4. `Result`'ı HTTP'ye eşle: hata kodu → `[durum, sabit Türkçe metin]` tablosu ([bff/gorevler.ts](../../apps/web/src/bff/gorevler.ts)). `String(error)` arayüze verilmez.

Hata kodu → HTTP eşlemesi bağlamlar arasında tutarlıdır: `gecersiz` 422, `yetki_yok` 403, `bulunamadi` 404 (başka ofisin kaydı dahil), `catisma` 409.

UI (`apps/web/src/features/<ctx>`) yalnız ekran ve form UX'idir; veriyi server component/server action ya da BFF ucu üzerinden alır, `platform`'a ve `infrastructure`'a dokunmaz.

## 5. Yeni iş eklerken kontrol listesi

Sıra, stratejikten taktiksele iner:

1. **Bağlam (§2.4):** İş hangi bağlamın? Sorumluluk tablosuna bak; iki bağlama da uyuyorsa sor. Yeni bağlam gerekiyorsa önce karar.
2. **Ortak dil (§2.3):** Yeni terim varsa sözlüğe ekle; kural ve hata kodu adlarını oradan al.
3. **Özellik:** `feature-registry`'ye anahtar, kırmızı kabul testi ([tdd.md §4.2](tdd.md#42-özellik-düzeyi-kayıttan-yeşile)).
4. **Aggregate (§3.3):** Değişiklik hangi aggregate'in sınırında? Kuralı `domain`'e saf fonksiyon olarak yaz (birim testli); değer nesnesi gerekiyorsa §3.2.
5. **Use-case (§3.6):** Akışı `application`'a yaz (in-memory repository'lerle testli); `Result` ve hata kodları.
6. **Repository (§3.4):** Yeni tablo gerekirse bağlam önekli, idempotent migration; PK `(org_id, id)`, RLS + pgTAP testi. Adaptör `infrastructure`'a (`*.int.test.ts` ile gerçek yığında).
7. **Bağlam ilişkisi (§2.5):** Başka bağlama ihtiyaç port, olay ya da public API ile; tabloya doğrudan değil.
8. **Mimari kabuk (§4):** `index.ts`'e adıyla ekle; bileşim kökünde bağla; BFF ucu tek yetki anahtarıyla ve hata eşleme tablosuyla.
9. **Belge:** Bağlam sayfasını (`docs/baglamlar/<ctx>.md`) aynı değişiklikte güncelle: kural, uç, ekran, test dosyası.

## 6. Kaçınılacaklar ve bilinen sapmalar

| | Yapma | Bunun yerine |
|---|---|---|
| Stratejik | Başka bağlamın tablosunu sorgulamak | Port + public API ya da okuma modeli |
| | Bağlamlar arası "ortak" `shared` paketi | Kernel'e (saf ve kararlıysa) ya da port + public API |
| | `controllers/`, `services/`, `utils/` gibi teknik klasör | İş alanı adıyla dosya (`task.ts`, `declarations.ts`) |
| | Sözlükte olmayan terimle kod yazmak | Terimi önce sözlüğe ekle |
| Taktiksel | Domain'de ya da use-case'te `new Date()`, `randomUUID()` | `Clock` / `newId` bağımlılık olarak gelir; testte sabit |
| | Domain'de `throw` ile iş hatası | `Result` / alan hata listesi |
| | İki aggregate'i tek işlemde değiştirmek | Ayrı use-case'ler ya da olay |
| | Kişisel veriyi olay yüküne/loga koymak | Kimlik (ID) taşı; ayrıntıyı tüketici kendi yetkisiyle okur |
| Mimari | Rotada/BFF'te iş kuralı (`if (status === 'Tamamlandı') …`) | Kuralı use-case'e taşı, BFF yalnız eşler |
| | UI'da yetki kararı | Yetki BFF + RLS'te; UI yalnız `FeatureGate` ile gösterir/gizler |

**Bilinen sapma (açık konu 7, [durum.md](../ai/durum.md)):** tax-filing, social-security ve workspace sorguları firma unvanı için `portfolio.firms` ile birleşir; bu, bounded context sınırının (§2.5) ihlalidir. Yeni kodda bu kalıp çoğaltılmaz; okuma modeline ya da portfolio public API'sine taşınması bekleniyor.

**Hedef ile bugün arasındaki farklar:** 06'daki bazı yerleşimler henüz farklıdır — kabul testleri `apps/web/e2e/` altındadır (06'da `features/<ctx>/test`), aggregate'ler sınıf değil tip + saf fonksiyon olarak yazılmıştır (§3), BFF ucu ve UI bileşen testi henüz yoktur. Yeni kod bugünkü kalıbı izler; değiştirmek isteyen önce karar önerir.

<!-- gezinti — node tools/docs/gezinti.mjs --yaz üretir, elle düzenlemeyin -->

---

[README](../../README.md) › [Genel bakış](../00-genel-bakis.md) › **DDD rehberi**
<!-- /gezinti -->
