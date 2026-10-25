# portfolio — Mükellef portföyü

> Durum: **C aşaması (2026-10-25)**: firma kartı (ekle, görüntüle, düzenle, arşivle), liste ve CSV, VKN tekilliği, kapsam RLS'i. Personel ataması ve mükellef kullanıcısı ekranları ile devir yok. Kaynak: [06 §2](../hedef-mimari/06-kaynak-kod-yapisi-ddd-tdd.md#2-bounded-context-haritası-ve-ortak-dil), [05 §2](../hedef-mimari/05-yetki-ve-hesap-modeli.md). Kod: `packages/contexts/portfolio` — dışarıya yalnız `src/index.ts`.

| | |
|---|---|
| Sorumluluk | Mükellef kartı, müşavir bağı (tek müşavir, D16), mükellef kullanıcıları, devir |
| Aggregate'ler (kök) | `Taxpayer` (tablo `portfolio.firms`), `AdvisorTransfer` |
| Yayınladığı olaylar | `TaxpayerRegistered`, `TaxpayerTransferred` (henüz yayımlanmıyor) |
| Özellik anahtarları | `firmalar.liste.*`, `firmalar.kart.*`, `yonetim.mukellef_kullanicilari.*` |
| Veritabanı şeması | `portfolio` (shard); VKN dizini `directory.taxpayer_registry` (kontrol düzlemi) |

## Kurallar

- Kart alanları ve seçenekleri eski portalın firma formundandır (`domain/firm.ts`): unvan, tür, VKN/TCKN, vergi dairesi, il, yetkili, iletişim, faaliyet, vergilendirme usulü, onay durumu, grup. Sermaye şirketi (Limited/Anonim) VKN ister.
- Her firmanın tek müşaviri vardır (`advisor_id NOT NULL`). Müşavir yalnız kendi adına, ofis yöneticisi herhangi bir müşavir adına firma ekler (RLS).
- **VKN/TCKN sistem genelinde tekildir** (D16, 07 §2.2): kontrol düzleminde HMAC özetiyle rezervasyon → shard'da kayıt → onay. Kimliğin kendisi kontrol düzlemine yazılmaz. Arşivlenen firmanın VKN'si serbest kalır.
- Kapsam (`app.can_see_firm`): ofis yöneticisi tüm firmalar, müşavir kendi portföyü, personel atandığı firmalar, mükellef bağlı olduğu firmalar. Kapsam dışı ya da başka ofisin firması 404'tür (varlığı sızdırılmaz).
- Arşivleme veriyi silmez (10 yıl, D23). Güncellemede iyimser kilit (`version`); çakışmada 409.
- CSV dışa aktarma ekrandaki süzgeçle aynı satırları verir, formül enjeksiyonuna karşı korunur ve denetim kaydına yazılır (`firmalar.disa_aktarildi`).

## BFF uçları ve ekranlar

- `POST /api/firmalar`, `PUT /api/firmalar/:id`, `POST /api/firmalar/:id/arsiv`, `GET /api/firmalar/csv`.
- Ekranlar: `/firmalar/liste` (sayaçlar, süzgeç, CSV, GİB hesabı durumu), `/firmalar/kart/yeni`, `/firmalar/kart/:id`.

## Testler

- Birim: `test/domain/firm.test.ts`, `test/application/firms.test.ts`.
- Entegrasyon (gerçek yığın): `test/infrastructure/portfoy.int.test.ts` (ofisler arası VKN tekilliği, HMAC, müşavir/personel/başka ofis kapsamı); pgTAP `supabase/tests/tenant/portfolio/kapsam.sql`.
- Kabul: `apps/web/e2e/firmalar.e2e.ts` — `firmalar.liste.view/export`, `firmalar.kart.view/create/edit/archive` yeşil.

## Açık işler

- Personel ataması ve mükellef kullanıcısı ekranları, müşavir devri (`firmalar.devir`), `TaxpayerRegistered` olayı, TCKN için kolon şifreleme.
