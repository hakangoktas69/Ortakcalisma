# notifications

> Alt alan: Genel · Kod: `apps/api/src/modules/notifications/` · Şema: `prisma/schema/notifications.prisma` · Kalıp: **olay abonesi** + ACL (Meta WhatsApp)

## Sorumluluk

Uygulama içi bildirim merkezi, sabah hatırlatıcıları, WhatsApp kanalı (rızalı), diğer bağlamların **olaylarını bildirime çevirme**.
**Yapmaz:** iş kararı vermez; kaynak bağlamın tablosuna yazmaz.

## Model

| Toplam | Kimlik | Değişmezler |
|---|---|---|
| `Notification` | `id`; (`tenantId`, `dedupeKey`) benzersiz | Aynı olay için ikinci bildirim yok (`dedupeKey`, olaylar için `event:<outboxId>`) · `externalBody` **kişisel veri içermez**; boşsa dış kanala genel metin gider |
| `NotificationRead` | (`notificationId`, `userId`) | Okunma **kullanıcı bazında** |
| `NotificationDelivery` | (`notificationId`, `userId`, `channel`) | Kuyrukta beklerken rıza geri çekildiyse gönderilmez · dış kanal başlığı kategori adıdır (`CATEGORY_LABEL`), bildirim başlığı değil |
| Kullanıcı ayarları (`User.phone`, `whatsappOptInAt`, `notifyCategories`) | — | Rıza numaraya bağlı: numara değişince düşer · WhatsApp ancak geçerli rızayla açılır |

## Olay aboneleri (`application/event-handlers.ts`)

| Olay | Uygulama içi | Dış kanal (`externalBody`) |
|---|---|---|
| `tebligat.imported` | "Yeni e-tebligat: *Unvan*", konu, gönderen, tebliğ tarihi | "N yeni e-tebligat; en yakın tebliğ sayılma tarihi …" |
| `sgk.reports.received` | "N yeni e-Rapor onay bekliyor: *Unvan*", çalışan adları | "N yeni e-rapor çalışmazlık bildirimi bekliyor." (**sağlık verisi + ad gitmez**) |
| `billing.license.extended` | "Lisans uzatıldı", paket ve tarih | aynısı (kişisel veri yok) |

Aboneler worker'da, olayın büro bağlamında (`runAsTenant`) çalışır ve idempotenttir.

## Kullanım senaryoları

`NotificationsService`: `notify`, `list`, `markRead`, `markAllRead`, `deliver` (worker). `RemindersService`: `runAll` (worker; her büro kendi RLS bağlamında), `runForTenant` (son günü 3 gün içinde/bugün olan beyannameler, gecikenler, tebliğ tarihi yaklaşan tebligatlar, e-Defter). `WhatsappChannel`: `off | mock | live`, `normalizePhone`, `templateParam`. Kuyruk işleyici `NotificationsProcessor` (**yalnız worker**): `deliver` (saniyede ≤ 10), `daily-reminders` 08:30.

## HTTP uçları

`GET /api/notifications?unread=` · `POST /api/notifications/:id/read`, `/read-all` · `GET /api/notifications/channels` · `POST /api/notifications/reminders/run` (ADMIN) · `GET/PUT /api/me/notification-settings` · `POST /api/me/notification-settings/test`

## Bağımlılıklar

`tax-filing` (Customer/Supplier: `DeclarationsService.control`, `EDefterService`); `eTebligat`'ı doğrudan okur (geçiş istisnası).

## Testler

`application/reminders.spec.ts`, `infrastructure/whatsapp.channel.spec.ts` (numara biçimi, şablon, canlı mod sahte Graph API) · e2e `test/notifications-workspace.e2e-spec.ts` (hatırlatıcı, kullanıcı bazlı okunma, rıza kuralları, başka büro), `test/worker.e2e-spec.ts` (olay → bildirim, yeniden teslimde tek bildirim, hata sonrası bekletme, WhatsApp kuyruk → SENT).

## Bilinen sınırlar

Meta canlı hesabıyla denenmedi; mobil push (Faz 4) bu bağlama kanal olarak eklenecek — aynı `externalBody` kuralıyla.
