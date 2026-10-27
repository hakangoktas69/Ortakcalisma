<!-- gezinti — node tools/docs/gezinti.mjs --yaz üretir, elle düzenlemeyin -->
[README](../../README.md) › [Genel bakış](../00-genel-bakis.md) › [Bağlamlar](README.md) › **workspace**
<!-- /gezinti -->

# workspace — Çalışma alanı

> Durum: **G aşaması (2026-10-25)**: görevler (eski "Takvim ve Görevler"), firma notları, ana sayfa sayaçları. **2026-10-27 (Mert 26.10 uyarlaması):** mali müşavir takvimi, kişisel hatırlatmalar, portal kısayolları (D43, D44). Uyarı/okundu ve raporlar yok. Kaynak: [06 §2](../hedef-mimari/06-kaynak-kod-yapisi-ddd-tdd.md#2-bounded-context-haritası-ve-ortak-dil). Kod: `packages/contexts/workspace` — dışarıya yalnız `src/index.ts`.

| | |
|---|---|
| Sorumluluk | Görev, not, uyarı/okundu, kontrol listeleri (okuma modeli) |
| Aggregate'ler (kök) | `Task` (`workspace.tasks`), `Note` (`workspace.notes`), `CalendarEntry` (`workspace.calendar_entries`), `Reminder` (`workspace.reminders`) |
| Yayınladığı olaylar | — |
| Özellik anahtarları | `genel_bakis.*` (`genel_bakis.takvim.view/edit/remind/sync`), `gorevler.*`, `notlar.*`, `kisayollar.view` |
| Veritabanı şeması | `workspace` (shard) |

## Kurallar

- Görev: başlık (1–120), mükellef (isteğe bağlı; yoksa "ofis geneli"), son tarih, sorumlu, durum (`Bekliyor`, `Devam Ediyor`, `Öncelikli`, `Tamamlandı`) — eski portalın alanları.
- Sorumlu verilmezse görevi oluşturan sorumludur; başkasına atamak `gorevler.assign` ister. Sorumlu ofisin iç kullanıcısı olmalıdır (identity-access public API'si, `MembershipReader.staff`); mükellef kullanıcısı sorumlu olamaz.
- Tamamlamak ve tamamlanmışı yeniden açmak `gorevler.close`, diğer durum değişiklikleri `gorevler.create` ister. Güncellemede iyimser kilit vardır (`version`, çakışmada 409).
- Kapsam (RLS): mükellef kullanıcıları ofisin görev ve notlarını görmez. Firmaya bağlı görev/not firma kapsamındadır (`app.can_see_firm`). Görevi yönetici/müşavir ya da sorumlusu/oluşturanı günceller. Başka ofisin görevi 404.
- Atama ve kapatma denetim kaydına yazılır (`gorev.atandi`, `gorev.kapatildi`).
- Notlar eklenir, değiştirilmez ve silinmez; yazan ve zaman görünür.
- Ana sayfa sayaçları kullanıcının yetkisi ve firma kapsamıyla hesaplanır; yetkisi olmayan sayaç gösterilmez. Sayaçlar: firma, onay bekleyen firma, açık/bana atanan/geciken görev, son dönem beyanname sayısı, son dönem SGK çalışanı, sorunlu kurum hesabı; son kurum işleri.

- **Takvim (D43):** kayıt kaynakları `tatil` (2429 sayılı Kanun; dinî bayramlar Nager.Date ya da Diyanet, kesin değilse `kesinlesmedi`, arifeler yarım gün), `gib` (GİB vergi takvimi, `eworks.gib.tax-calendar.v1`, fail-closed: şema, sayı, tekillik, yıl), `kural` (SGK prim son günü 5510 md. 88 — son gün tatil/hafta sonu ise ilk iş günü, `kesinlesmedi`; çeyrek ve hesap dönemi sonları). MUHSGK (açıklamada "Muhtasar ve Prim Hizmet") personel kategorisidir. GİB tarihleri genel yükümlülüktür, mükellefe özel hesap yapılmaz.
- Takvim ofisin shard'ında kopyadır; yalnız işçi (sistem bağlamı) yazar, ofis personeli okur, mükellef görmez. İşçi her 10 dakikada ofislerin bulunulan yılını (Ekim'den sonra gelecek yılı da) hazır kaynaktan doldurur (`BundledCalendarSources`: GİB 2026 anlık görüntüsü, Diyanet 2026); GİB verisi eksik yılda kamuya açık veri yıl başına bir kez çekilir, doğrulanmış sonuç ortak anahtarda (`ortak/takvim/<yıl>.json`) tutulur ve diğer ofislerin kopyası kuruma gitmeden ondan doldurulur; ortak sonuç yoksa ya da 7 günden eskiyse yalnız bir ofis için iş açılır (`takvim.kaynaklar`, sync bağlamı).
- Tarih düzeltme yalnız ofis yöneticisi (`genel_bakis.takvim.edit`; veritabanında `workspace.correct_calendar_entry`, denetim kaydı `takvim.tarih_duzeltildi`); düzeltme yeniden içe aktarmada korunur ve kesin sayılır.
- **Kişisel hatırlatma:** başlık, tarih, isteğe bağlı saat, kategori (Mert'in listesi), isteğe bağlı mükellef, not, 0/1/3/7 gün önce. Yalnız sahibi görür/değiştirir (RLS `user_id = app.uid()`), firma kapsamı `can_see_firm`. Uyarı uygulama içidir: takvimde "Yaklaşan hatırlatmalar", ana sayfada sayaç.
- **Portal kısayolları (D44):** `PORTAL_LINKS` — yalnız `https` ve `.gov.tr`; yeni sekmede, kimlik aktarımı yok. Ofis kullanıcılarına açık, mükellefe kapalı.

## BFF uçları ve ekranlar

- `POST /api/gorevler`, `POST /api/gorevler/:id/durum`, `POST /api/gorevler/:id/ata`, `POST /api/notlar`, `PUT /api/takvim` (tarih düzeltme), `POST /api/hatirlatmalar`, `POST|DELETE /api/hatirlatmalar/:id`, `POST /api/sync/takvim` (sync).
- Ekranlar: `/gorevler`, `/notlar`, `/` (genel bakış), `/genel_bakis/takvim` (ay / hafta / gün / yıl / liste), `/kisayollar`.

## Testler

- Birim: `test/application/workspace.test.ts`.
- Entegrasyon (gerçek yığın): `test/infrastructure/workspace.int.test.ts` (personel kapsamı, başka ofis, ofis dışı kişiye atama, denetim kaydı).
- Kabul: `apps/web/e2e/calisma-alani.e2e.ts` — `gorevler.*`, `notlar.*`, `genel_bakis.panel.view`; `apps/web/e2e/takvim.e2e.ts` — `genel_bakis.takvim.*`; `apps/web/e2e/kisayollar.e2e.ts` — `kisayollar.view`.
- pgTAP: `supabase/tests/tenant/workspace/{takvim,hatirlatma}.sql`.

## Açık işler

- Takvim: `genel_bakis.takvim.sync` canlı kayıt bekler (D33); hatırlatmanın e-posta/SMS bildirimi (notifications bağlamı). Görev CSV'si, uyarılar (`bildirimler`), son gün kurallarından otomatik görev, firma kartında notlar.
- Okuma birleşimleri: bazı bağlam sorguları `portfolio.firms` ile birleşir (unvan için). Bağlam sınırına uygun okuma modeline taşınacak (bkz. [durum.md](../ai/durum.md)).

<!-- gezinti — node tools/docs/gezinti.mjs --yaz üretir, elle düzenlemeyin -->

---

[README](../../README.md) › [Genel bakış](../00-genel-bakis.md) › [Bağlamlar](README.md) › **workspace**
<!-- /gezinti -->
