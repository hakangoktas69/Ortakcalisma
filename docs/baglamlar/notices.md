<!-- gezinti — node tools/docs/gezinti.mjs --yaz üretir, elle düzenlemeyin -->
[README](../../README.md) › [Genel bakış](../00-genel-bakis.md) › [Bağlamlar](README.md) › **notices**
<!-- /gezinti -->

# notices — Tebligat

> Durum: **2026-10-27 (D45, Mert 26.10 uyarlaması):** GİB Dijital VD e-Tebligat listesi, firmanın kendi hesabıyla ve mükellef onayıyla (D46). İleride UETS (PTT) aynı bağlama girer. Kod: `packages/contexts/notices` — dışarıya yalnız `src/index.ts`. Kararlar ve etkileri: ekip hafızası `eworks-etebligat-kararlari`.

| | |
|---|---|
| Sorumluluk | e-Tebligat liste bilgisi (belge no ve türü, gönderen kurum/alt birim, gönderim, tebliğ, mükellef okuma tarihi) |
| Aggregate'ler (kök) | `Notice` (`notices.notices`) |
| Yayınladığı olaylar | — |
| Özellik anahtarları | `tebligat.liste.view`, `tebligat.liste.sync` (`live: true`, D33) |
| Veritabanı şeması | `notices` (shard) |

## Kurallar

- **Belge açılmaz, okundu işaretlenmez.** Belgeyi açmak tebliğ sonucu doğurabilir; ACL yalnız liste ucunu okur.
- **Okuma tarihi boşsa "tebliğ edilmedi" denmez** (`noticeStatusLabel`: "Okuma tarihi yok"). Liste "gözlenen liste süzgeci" kapsamındadır; arşiv ve diğer kutular tamamlandı sayılmaz.
- Liste firmanın **kendi GİB hesabıyla** okunur; iş yalnız **etkin mükellef onayı** varken açılır (BFF) ve sır yalnız onay varken verilir (`credentials.secret_for_job`, `EW001`). ACL girişten sonra görünen hesap kimliğini (profil düğmesi) firma VKN/TCKN'siyle karşılaştırır; eşleşmezse liste okunmaz.
- Doğrulama fail-closed (ACL + domain): toplam, sayfa sayısı, tekil kayıt, tarih biçimi; hesap doğrulanmamış ya da belge açılmış bayrağı → hiçbir kayıt yazılmaz.
- Kurum kayıt kimliği (`tebligId`) açık saklanmaz: `notice_key` = SHA-256. Liste yeniden alınınca kayıtlar güncellenir, yinelenmez.
- Kapsam (RLS): firmayı gören ofis kullanıcısı ve mükellef kendi firması okur; yalnız işçi yazar. Şahıs firmasında kişisel veri sayılabilir: loglara içerik girmez, CSV yok.

## Akış

İş `gib.etebligat` (sync) → ACL `institutions/gib/etebligat.py` (giriş, kimlik eşleşmesi, E-Tebligat menüsü, `tebligat-listele` ucunun sayfa alanı ilerletilerek sayfa sayfa okunması; istekler sayfanın içinden, hız sınırlayıcıdan geçer) → `contracts/integration/eworks.gib.notices.v1.schema.json` → işçi `importNotices`.

## BFF uçları ve ekranlar

- `POST /api/sync/etebligat` (tek firma) ve `POST /api/sync/etebligat/toplu` (tüm mükellefler) — ikisi de `tebligat.liste.sync`; `PUT|DELETE /api/kurum-hesaplari/onay` (credentials, `firmalar.kurum_hesaplari.consent`).
- Ekran: `/tebligat/liste` — firma seçiliyken tek firma güncellemesi (yalnız onay varken), firma seçili değilken "Tüm mükelleflerin e-Tebligatını çek".
- **Toplu çekim firma başına ayrı iştir:** liste kurumda oturuma bağlıdır ve istekte mükellef kimliği taşınmaz, bu yüzden beyannamedeki gibi tek müşavir oturumuyla okunamaz. Karar `apps/web/src/bff/tebligat-toplu.ts`: arşivli, onaysız, GİB hesabı olmayan ya da şifresi hatalı/kilitli firma atlanır ve özette sayılır. Şifresi hatalı hesap bilerek denenmez (kurum hesabının kilitlenmesini önler, 05 §4).

## Testler

- Birim: `test/domain/tebligat.test.ts`, `test/application/tebligat.test.ts`; işçi `apps/worker/test/uygulayici.test.ts`.
- Entegrasyon: `test/infrastructure/tebligat.int.test.ts`; onay ve sır kapısı `packages/contexts/sync/test/infrastructure/isler.int.test.ts`.
- pgTAP: `supabase/tests/tenant/notices/tebligat.sql`, `supabase/tests/tenant/credentials/onay.sql`.
- ACL: `services/integration/tests/test_etebligat.py` (sahte GİB; canlı değildir).
- Kabul: `apps/web/e2e/tebligat.e2e.ts`.

## Açık işler

- Canlı doğrulama kaydı (D33). UETS. Arşiv/diğer kutular. Firma bazlı "son iş" görünümü (açık konu 31 ile aynı). Onay beyanının hukuki dayanağı (açık konu 30).

<!-- gezinti — node tools/docs/gezinti.mjs --yaz üretir, elle düzenlemeyin -->

---

[README](../../README.md) › [Genel bakış](../00-genel-bakis.md) › [Bağlamlar](README.md) › **notices**
<!-- /gezinti -->
