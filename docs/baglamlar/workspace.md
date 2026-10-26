<!-- gezinti — node tools/docs/gezinti.mjs --yaz üretir, elle düzenlemeyin -->
[README](../../README.md) › [Genel bakış](../00-genel-bakis.md) › [Bağlamlar](README.md) › **workspace**
<!-- /gezinti -->

# workspace — Çalışma alanı

> Durum: **G aşaması (2026-10-25)**: görevler (eski "Takvim ve Görevler"), firma notları, ana sayfa sayaçları. Takvim görünümü, uyarı/okundu ve raporlar yok. Kaynak: [06 §2](../hedef-mimari/06-kaynak-kod-yapisi-ddd-tdd.md#2-bounded-context-haritası-ve-ortak-dil). Kod: `packages/contexts/workspace` — dışarıya yalnız `src/index.ts`.

| | |
|---|---|
| Sorumluluk | Görev, not, uyarı/okundu, kontrol listeleri (okuma modeli) |
| Aggregate'ler (kök) | `Task` (`workspace.tasks`), `Note` (`workspace.notes`) |
| Yayınladığı olaylar | — |
| Özellik anahtarları | `genel_bakis.*`, `gorevler.*`, `notlar.*` |
| Veritabanı şeması | `workspace` (shard) |

## Kurallar

- Görev: başlık (1–120), mükellef (isteğe bağlı; yoksa "ofis geneli"), son tarih, sorumlu, durum (`Bekliyor`, `Devam Ediyor`, `Öncelikli`, `Tamamlandı`) — eski portalın alanları.
- Sorumlu verilmezse görevi oluşturan sorumludur; başkasına atamak `gorevler.assign` ister. Sorumlu ofisin iç kullanıcısı olmalıdır (identity-access public API'si, `MembershipReader.staff`); mükellef kullanıcısı sorumlu olamaz.
- Tamamlamak ve tamamlanmışı yeniden açmak `gorevler.close`, diğer durum değişiklikleri `gorevler.create` ister. Güncellemede iyimser kilit vardır (`version`, çakışmada 409).
- Kapsam (RLS): mükellef kullanıcıları ofisin görev ve notlarını görmez. Firmaya bağlı görev/not firma kapsamındadır (`app.can_see_firm`). Görevi yönetici/müşavir ya da sorumlusu/oluşturanı günceller. Başka ofisin görevi 404.
- Atama ve kapatma denetim kaydına yazılır (`gorev.atandi`, `gorev.kapatildi`).
- Notlar eklenir, değiştirilmez ve silinmez; yazan ve zaman görünür.
- Ana sayfa sayaçları kullanıcının yetkisi ve firma kapsamıyla hesaplanır; yetkisi olmayan sayaç gösterilmez. Sayaçlar: firma, onay bekleyen firma, açık/bana atanan/geciken görev, son dönem beyanname sayısı, son dönem SGK çalışanı, sorunlu kurum hesabı; son kurum işleri.

## BFF uçları ve ekranlar

- `POST /api/gorevler`, `POST /api/gorevler/:id/durum`, `POST /api/gorevler/:id/ata`, `POST /api/notlar`.
- Ekranlar: `/gorevler`, `/notlar`, `/` (genel bakış).

## Testler

- Birim: `test/application/workspace.test.ts`.
- Entegrasyon (gerçek yığın): `test/infrastructure/workspace.int.test.ts` (personel kapsamı, başka ofis, ofis dışı kişiye atama, denetim kaydı).
- Kabul: `apps/web/e2e/calisma-alani.e2e.ts` — `gorevler.*`, `notlar.*`, `genel_bakis.panel.view` yeşil.

## Açık işler

- Takvim görünümü (`genel_bakis.takvim`), görev CSV'si, uyarılar (`bildirimler`), son gün kurallarından otomatik görev, firma kartında notlar.
- Okuma birleşimleri: bazı bağlam sorguları `portfolio.firms` ile birleşir (unvan için). Bağlam sınırına uygun okuma modeline taşınacak (bkz. [durum.md](../ai/durum.md)).

<!-- gezinti — node tools/docs/gezinti.mjs --yaz üretir, elle düzenlemeyin -->

---

[README](../../README.md) › [Genel bakış](../00-genel-bakis.md) › [Bağlamlar](README.md) › **workspace**
<!-- /gezinti -->
