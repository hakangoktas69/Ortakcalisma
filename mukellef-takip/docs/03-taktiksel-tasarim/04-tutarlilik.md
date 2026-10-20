# 3.4 Tutarlılık, transaction ve eşzamanlılık

> Üst: [Yapı taşları](02-yapi-taslari.md) · İlgili: [Olaylar ve outbox](03-olaylar-ve-outbox.md), [Veri modeli](../04-mimari/02-veri-modeli.md)

## İlke

| Kapsam | Tutarlılık türü | Araç |
|---|---|---|
| Bir aggregate içinde | **Anında (strong)** | Tek `prisma.$transaction`, benzersiz indeks, koşullu güncelleme |
| Bir bağlamın birden çok aggregate'i | Tercihen anında; mümkün değilse idempotent yeniden çalıştırma | `$transaction` veya yeniden çalıştırılabilir senkron işi |
| Bağlamlar arası | **Nihai (eventual)** | Outbox olayı + idempotent abone |
| Okuma modeli (`workspace`) | Her istekte kaynaktan türetilir → gecikme yok | Facade çağrıları |

Bir kullanım senaryosu **birden çok bağlamın tablosunu aynı transaction'da** değiştirmek istiyorsa sınır yanlış çizilmiş olabilir: önce bağlam haritasını gözden geçir.

## Kalıplar (kodda kullanılanlar)

### 1. Koşullu durum geçişi (optimistic, kilitsiz)

```ts
const { count } = await tx.payment.updateMany({
  where: { id: p.id, status: 'PENDING' },   // beklenen önceki durum
  data: { status: 'PAID', paidAt: new Date() },
});
if (count === 0) return { already: true };   // başka istek kazandı
```
Kullanım: `BillingService.markPaid` (iyzico geri dönüşü + "Yenile" aynı anda), `cancel`.

### 2. Upsert + benzersiz anahtar (idempotent içe aktarma)

GİB/SGK tablosu aynı sayfadan iki kez gelebilir. Doğal anahtar benzersiz indekstir: beyanname (mükellef, tür, dönem), tebligat (mükellef, belge no), e-rapor (Medula rapor id), e-Bildirge (işyeri, dönem, belge türü). İkinci aktarım "güncelle" olarak sayılır; önizleme (`dryRun`) bunu `create / update / skip` olarak gösterir.

### 3. Tek transaction'da aggregate + olay

`markPaid`: ödeme durumu + abonelik + `OutboxEvent` aynı `tx`. Ya hepsi ya hiçbiri.

### 4. Kiralama ile iş dağıtımı

Outbox: `FOR UPDATE SKIP LOCKED` + `availableAt` ileri alınır (5 dk) → çökmüş worker'ın kiraladığı satır süresi dolunca başkasına geçer. BullMQ işleri Redis'te benzer şekilde kilitlenir.

### 5. Refresh token rotasyonu

Her yenilemede eski token `replacedAt` alır, yenisi aynı `familyId` ile üretilir. Değiştirilmiş bir token **yeniden** kullanılırsa çalınma kabul edilir ve aile tamamen iptal edilir. `User.sessionVersion` artınca (şifre veya 2FA değişikliği, rol değişikliği, devre dışı bırakma, yöneticinin şifre sıfırlaması) tüm oturumlar geçersizleşir.

## RLS ve transaction etkileşimi

- Bağlam (büro / sistem) **bağlantı havuzdan alınırken** oturuma yazılır (`rls-pool.ts`). `$transaction` tek bağlantı kullandığından tüm sorgular aynı büroyla çalışır.
- Prisma sorguları tembeldir: `runAsTenant(id, () => prisma.x.findMany())` sorguyu bağlamın **içinde** başlatır (`runIn` → `.then`). Bir sorguyu bağlam dışında oluşturup sonra `await` etmek onu bağlamsız (= hiçbir satır görmeyen) çalıştırır. Bkz. [Tuzaklar](../05-gelistirici-rehberi/04-tuzaklar.md).
- `runAsSystem` RLS'i atlar; yalnız büroyu henüz bilmeyen güvenilir yollarda: giriş, oturum doğrulama, iyzico geri dönüşünde ödemeyi token'la bulma, outbox kiralama, zamanlanmış işlerin büro listesini alma. Bulduktan sonra **hemen** `runAsTenant`'a geç.

## Saat ve tarih

- Tüm zamanlar UTC saklanır; iş günü/tatil hesabı Türkiye takvimiyle `domain/` fonksiyonlarında (`declaration-rules.ts`, tebliğ sayılma tarihi).
- Fonksiyonlar `now = new Date()` parametresi alır → testte sabit tarih verilir; `Date.now()`'ı domain içinde doğrudan kullanma.

## Dış sistemlerle tutarlılık

| Dış sistem | Risk | Önlem |
|---|---|---|
| iyzico | Tarayıcı geri dönüşü taklit edilebilir | Geri dönüşteki veriye güvenilmez; sunucu iyzico'ya **sorar** (`retrieve`), tutar/sepet/fraud karşılaştırılır |
| SGK Vizite | Okunan rapor kapatılmazsa yenileri gelmez | Kaydet → sonra `markRead`; kaydetme başarısızsa kapatma yapılmaz (rapor kaybolmaz) |
| WhatsApp | Gönderim yinelenebilir | `NotificationDelivery` tekil (bildirim, kullanıcı, kanal); `SENT` olan iş yeniden gönderilmez, rıza gönderim anında yeniden kontrol edilir |
| Claude API | Akış yarıda kesilebilir | Kullanıcı mesajı önce yazılır, asistan yanıtı `done`'da; hata `error` olayıyla döner |
