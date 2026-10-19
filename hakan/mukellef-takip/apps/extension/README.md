# GİB/SGK Aktarıcı (Chrome eklentisi)

Mali müşavirin **kendi açtığı** GİB e-Beyanname / e-Tebligat veya SGK e-Bildirge sayfasındaki listeyi, onayıyla Mükellef Takip'e aktarır.
Sayfada ne olduğu (beyanname, tebligat, e-Bildirge belgeleri) sunucuda tablo başlıklarından anlaşılır.

## Ne yapar, ne yapmaz

- Sadece kullanıcı "Bu sayfayı oku"ya bastığında, sadece o sekmedeki tabloları okur (`activeTab` + `scripting`).
- GİB'e veya SGK'ya kendisi istek atmaz, sayfada tıklama/gezinme yapmaz, şifre görmez veya saklamaz.
- Sadece `gib.gov.tr` ve `sgk.gov.tr` alan adlarındaki sayfalarda çalışır (geliştirmede `localhost` da).
- Önce önizleme gösterir (API'ye `dryRun: true`), kullanıcı "Aktar"a basınca kaydeder.
- Portal şifresi yerine **eklenti anahtarı** kullanır. Anahtar sadece `POST /api/import/page` uç noktasına erişebilir; portal ekranından istenildiği an iptal edilir.
- e-Tebligat sayfasında VKN sütunu yoksa (mükellefin kendi oturumu), önizlemede mükellefin VKN/TCKN'si sorulur.
- e-Bildirge sayfasında işyeri, satırdaki sicil no sütunundan ya da sayfa metninde geçen sicil numarasından (portalda tek bir işyerine uyuyorsa) bulunur; bulunamazsa önizlemede sicil no sorulur.

## Kurulum (geliştirme)

1. Portalda e-Beyanname → **GİB'den aktar** → **Anahtar oluştur**, anahtarı kopyalayın.
2. Chrome → `chrome://extensions` → **Geliştirici modu** → **Paketlenmemiş öğe yükle** → bu klasörü (`apps/extension`) seçin.
3. Eklenti simgesine tıklayın, API adresini (`http://localhost:4000/api`) ve anahtarı girin.

## Dosyalar

| Dosya | Görev |
|---|---|
| `manifest.json` | Manifest V3; izinler: `activeTab`, `scripting`, `storage` |
| `extract.js` | Sayfaya enjekte edilen okuyucu: tabloların başlık ve hücre metinleri, sayfadaki sicil no adayları |
| `popup.html` / `popup.js` | Ayarlar, önizleme ve aktarım akışı |

Tabloların tanınması sunucuda yapılır (beyanname: `apps/api/src/declarations/import/table-parser.ts`, tebligat: `apps/api/src/tebligat/tebligat-parser.ts`, e-Bildirge: `apps/api/src/sgk/ebildirge/ebildirge-parser.ts`):
sütun **başlıklarına** bakılır (Vergi Kimlik No, Beyanname Türü, Dönem, Durum, Onay/Yükleme Zamanı, Tahakkuk, OID).
GİB arayüzü değişirse çoğu durumda sadece oradaki başlık kalıpları güncellenir; eklentinin yeniden dağıtılması gerekmez.

## Bilinen sınırlar

- GİB e-Beyanname ve e-Tebligat sayfalarının gerçek HTML yapısı henüz canlı bir hesapla doğrulanmadı. İlk kullanımda önizlemedeki
  "tanınmayan tür / okunamayan dönem / görülen başlıklar" bilgileri, başlık kalıplarını ayarlamak için kullanılmalı.
- SGK e-Bildirge "onaylı bildirge listesi" sütun başlıkları (Dönem/Yıl-Ay, Belge Türü, Kanun No, Mahiyet, Sigortalı Sayısı, Prim Günü, PEK, Tahakkuk) tahmine dayanır; gerçek sayfayla doğrulanmadı.
- Sayfada görünmeyen (sonraki sayfalardaki) satırlar okunmaz; listeyi sayfa sayfa aktarın.
- Üretimde API adresi `https` olmalı; eklenti o adres için kullanıcıdan izin ister.
