# Vizyon ve kapsam

## Kim için

**Mali müşavir büroları** (SMMM/YMM) ve büro personeli. Bir büro onlarca–yüzlerce mükellefi (şirket, şahıs işletmesi, basit usul) takip eder. Her büro ayrı bir müşteri (tenant); büro içinde roller: `ADMIN` (büro sahibi/yönetici), `STAFF` (personel).

## Çözdüğü sorun

Müşavir her ay onlarca kurum ekranını (GİB e-Beyanname, e-Tebligat, e-Defter, SGK Vizite/e-Bildirge/4A, entegratör portalları) tek tek açıp "kim verdi, kim vermedi, ne yaklaşıyor" sorusunu elle cevaplıyor. Mükellef Takip bu durumu **tek bir iş kutusunda** toplar:

- Son günü yaklaşan / geçen beyannameler ve e-Defter beratları
- İncelenmemiş e-tebligatlar (tebliğ sayılma tarihine kalan gün)
- Onay bekleyen SGK e-raporları, işe giriş/çıkışlar, e-Bildirge
- Fatura (UBL-TR) temelli KDV ön kontrol, bordro ↔ e-Bildirge mutabakatı
- Hatırlatıcı bildirimler (uygulama içi, WhatsApp; ileride mobil push)
- Dilekçe şablonları, CSV raporlar, mevzuat asistanı

## İlkeler

1. **Güven, özellikten önce gelir.** Ürün kişisel veri ve kurum şifresi işler; bir veri sızıntısı ürünü bitirir. Güvenlik kararları ürün kararlarıdır (bkz. `security-kvkk.md`).
2. **Kullanıcı kontrolü:** Resmi kuruma yazan her işlem açık kullanıcı eylemidir. GİB'e robotla giriş yapılmaz; veri kullanıcının kendi oturumundan eklentiyle okunur.
3. **Türetilmiş durum:** İş kutusu saklanmaz, kaynak veriden her seferinde türetilir; tutarsızlık birikmez.
4. **Önizleme → onay:** Her toplu içe aktarma önce ne yapacağını gösterir (`dryRun`).
5. **Dürüstlük:** Doğrulanmamış entegrasyon ve kural (ör. Ekim–Aralık e-Defter son günü) açıkça "doğrulanmadı / elle girilir" olarak gösterilir. Portal beyanname veya bordro **hesaplamaz**, kontrol eder.

## Kapsam dışı (bilinçli olarak)

- Muhasebe/defter tutma, beyanname hazırlama ve gönderme, bordro hesaplama
- GİB şifresi saklama, GİB'e otomatik giriş, CAPTCHA aşma
- Mükellefin (son müşteri) portala girişi — şimdilik yalnız büro kullanıcıları

## Kanallar

- **Web** (ana çalışma ekranı), **Chrome eklentisi** (GİB/SGK sayfasından aktarım), **mobil** (Faz 4: iş kutusu, bildirim, onay; veri girişi değil).

## Barındırma

Türkiye'de VM / on-prem, Docker ile (KVKK veri yerelliği). Yurt dışına veri aktaran tek bileşen yapay zekâ asistanıdır ve büro yöneticisinin açık onayı olmadan kapalıdır.
