# Görsel karşılaştırma: Mükellef Takip, Eworks 1 ve Eworks 2

> Hazırlanma: 26.10.2026. Sürümlerin tanımı, yerleri ve işlev karşılaştırması: [karsilastirma-fonksiyonel.md](karsilastirma-fonksiyonel.md).
>
> Kısa adlar:
>
> - **Mükellef Takip:** [hakan/mukellef-takip/](hakan/mukellef-takip/README.md)
> - **Eworks 1:** [mert/eworks/entegrasyon-1-tarayici/](mert/eworks/README.md), 21.10.2026
> - **Eworks 2:** yalnız `dev` dalında `mert/eworks/entegrasyon-2-servis/`, 23.10.2026

## 1. Yöntem

Üç uygulama tarayıcıda açıldı; 1366 px (masaüstü) ve 375 px (telefon) genişlikte ekran görüntüsü alındı:

| | Nasıl açıldı | Veri |
|---|---|---|
| Mükellef Takip | Docker demo yığını | Projenin sahte seed verisi |
| Eworks 1 | HTML portal; Supabase yanıtları taklit edildi | 12 sentetik firma |
| Eworks 2 | `dev`'den geçici klasöre çıkarıldı, Eworks 1 ile aynı yöntem | Aynı 12 sentetik firma |

Robot, yerel köprü ve eklenti çalıştırılmadı. Ekran görüntüleri depoya eklenmedi (kural 9); aynı görüntüleri almak için uygulamaları yukarıdaki gibi açmak yeterli.

**Doğrulanamayanlar:**

- Renk kontrast oranları ölçülmedi; ekran okuyucuyla deneme yapılmadı.
- 768 ve 1920 px genişlikler denenmedi. Eworks 2'nin kendi belgesi tabloların 1440/1024/768/600/390 px'de taşmadığını söylüyor; bunu yalnız 375 ve 1366 px'de doğruladım.
- Mükellef Takip satış portalı açılamadı (demo yığınında satış API'si sağlıksız kaldı).

## 2. Kısa sonuç

| | Mükellef Takip | Eworks 1 | Eworks 2 |
|---|---|---|---|
| Genel izlenim | Sade, yoğun, iş aracı gibi: beyaz zemin, ince çizgiler, küçük rozetler | Kurumsal ve gösterişli: koyu lacivert + altın sarısı, büyük yuvarlak kartlar, geniş boşluklar | = Eworks 1 |
| Gezinme | Sol kenar menüsü + Ctrl+K komut paleti | Kenar menüsü gizli; kategori kartları → modül → alt sayfa, "← geri" düğmesi | = Eworks 1 |
| Bilgi yoğunluğu | Yüksek: 1366 × 900 ekranda ~15 mükellef satırı | Düşük: firma listesi ilk ekranın altında, satır başına ~85 px | = Eworks 1; e-Defter matrisi yoğun ve tek bakışta okunuyor |
| Koyu tema | Var (açık / sistem / koyu) | Yok | Yok |
| Telefonda tablolar | Bilinçli yatay kaydırma, taşma testleri var | Beyanname ve e-Bildirge tablosunda Durum ve Detay sütunları ekran dışında | Satırlar etiketli kartlara dönüşüyor; Detay her zaman görünür |
| Tutarlılık | Tüm sayfalar aynı kabuk ve bileşenler | Özel ekranlar zengin; ~30 sayfa aynı genel tablo şablonu | = Eworks 1 |

## 3. Marka ve görsel dil

| Öğe | Mükellef Takip | Eworks 1 | Eworks 2 |
|---|---|---|---|
| Ad ve logo | "Mükellef Takip — Mali müşavir büroları için"; mor kare içinde onay işareti | "Eworks — Dijital İş Portalı"; resim logo | = Eworks 1 |
| Ana renk | Indigo (Tailwind `indigo`, `brand`) | Lacivert `#102f61` / `#2166a3`, vurgu altın `#ffc909` | = Eworks 1 |
| Zemin | Beyaz ve çok açık gri (`slate-50`) | Açık mavi-gri `#f5f8fd` | = Eworks 1 |
| Yazı tipi | Plus Jakarta Sans | Segoe UI (sistem), taban 13 px | = Eworks 1 |
| Köşe yuvarlaklığı | Orta (`rounded-lg/xl`) | Büyük (kartlarda 15–18 px) | = Eworks 1; e-Defter belge kutucukları 8 px |
| Gölge | Çok hafif; ayrım çizgilerle | Belirgin yumuşak gölgeler | = Eworks 1 |
| Simgeler | lucide-react | El yazımı SVG yolları | = Eworks 1 |
| Tema altyapısı | Tailwind ölçekleri `.dark` altında tersine çevriliyor | CSS değişkenleri; bileşenlerde çok sayıda sabit renk | = Eworks 1; yeni e-Defter ve tablo stilleri de sabit renkli |
| Alt bilgi şeridi | Yok | "Supabase kalıcı kayıt · Yalnızca kayıtlı veriler gösterilir" | "Developer · İkinci entegrasyon · Canlı kayıtlar" |

## 4. Ekran ekran

### Giriş

| Mükellef Takip | Eworks 1 | Eworks 2 |
|---|---|---|
| "Defter kâğıdı" teması: 32 px aralıklı satır çizgileri, solda kırmızı kenar çizgisi. Büyük ekranda solda tanıtım metni ve üç madde, sağda beyaz form kartı. Güvenlik kodu ve 2FA aynı kartta. Telefonda yalnız form | Koyu lacivert zemin, dönen yörünge animasyonu (hareket azaltma tercihine uyar). Ortada beyaz kart, altın "Giriş yap". Türkçe/İngilizce seçimi. Üstte ve altta sabit bilgi şeritleri | = Eworks 1 (alt şerit metni farklı) |

### Ana sayfa

| Mükellef Takip | Eworks 1 | Eworks 2 |
|---|---|---|
| **İş kutusu** (`/`): solda gecikenler/bu hafta gruplu liste, sağda ayrıntı ve "Sonra hatırlat"; sekmeler ve tür etiketleri; ok tuşlarıyla gezinme. **Genel bakış** (`/ozet`): yapılacaklar, haftalık takvim, 4 sayaç, beyanname çubukları, bildirimler | "İşlerinizi tek merkezden yönetin" altında 4 koyu kategori kartı (Günlük Yönetim, Ofis ve Raporlama, Ödeme, Destek). Sayı veya uyarı yok; yalnız gezinme | = Eworks 1 |

### Firma listesi

| Mükellef Takip | Eworks 1 | Eworks 2 |
|---|---|---|
| Başlık, "Excel'den aktar", "Yeni firma"; arama + tür filtresi; sıkışık tablo (unvan, VKN/TCKN, tür, vergi dairesi, durum). Tablo ilk ekranda | Tablodan önce: GİB aktarım paneli, firma işlemleri şeridi, 6 koyu istatistik kartı, 3 e-belge kartı, 2 dağılım kutusu, filtre, hızlı filtre çipleri. Liste 1366 px ekranda ~1.400 px aşağıda. Satırda G/S/V durum çipleri, "2025 hasılat" kutusu, iletişim çipleri, iki düğme | = Eworks 1 |

### e-Beyanname

| Mükellef Takip | Eworks 1 | Eworks 2 |
|---|---|---|
| "Beyanname Kontrol": dönem seçimi, tür bazında yığılmış çubuklar, mükellef × tür matrisi; hücrede simge + metin | "e-Beyanname Görüntüleme": 4 sayaç, yıl kutuları, 12 ay düğmesi, "Dönem aralığı / Yükleme zamanı" anahtarı, sağda "Beyanname Çek" paneli; altında kayıt tablosu ve "Detay →" | Eworks 1 + "Önceki belge hatalarını yeniden dene" düğmesi + tam genişlikte "GİB bağlantı kontrolü" paneli. Kayıt tablosu sabit sütun genişlikli, uzun metin satır kırıyor; Detay sağa yaslı |

### SGK

| Mükellef Takip | Eworks 1 | Eworks 2 |
|---|---|---|
| Sekmeli tek sayfa: e-Rapor, İşe Giriş/Çıkış, e-Bildirge, İşyerleri; üstte "Demo modu" şeridi | Menüde 5 alt sayfa; yalnız e-Bildirge'nin özel paneli var (MUHSGK · SGK belgeleri, tarih aralığı, "Kalan mükellefleri kontrol et"). Diğerleri genel tablo | = Eworks 1; e-Bildirge tablosu e-Beyanname gibi sığdırılmış, çalışan sayısı sütunlu |

### e-Defter

| Mükellef Takip | Eworks 1 | Eworks 2 |
|---|---|---|
| Berat son günleri tablosu, satırda "yüklendi" işareti | Firma ve yıl seçimi, 4 dönem kartı, seçili dönemin 3 ay kartı (rozet, "Dosya Ekle", "Kontrol"), sürükle-bırak alanı. Tek firmaya odaklı | Tamamen yeni: Tümü/Kurum/Şahıs anahtarı, yıl, arama, son güncelleme kutusu; 4 sayaç (firma kapsamı, aktif yıl, kaynak kaydı bulunan, doğrulama bekleyen); **tüm firmalar × 12 ay matrisi**, her hücrede YB/KB/Y kutucukları (mavi = doğrulanmış belge, gri = kontrol edilmedi); ilk sütun yatay kaydırmada sabit. Sarı uyarı: "Canlı e-Defter bağlantısı henüz doğrulanmadı". "GİB'den belge çek" soluk ve pasif. Eski ekran "Yerel dosya takibi" düğmesiyle çekmecede |

Eworks 2 e-Defter gözlemleri:

- Sentetik veride 3 firmaya kaynak kaydı verildi; sayaç "Kaynak kaydı bulunan firma 3" gösterdi.
- Belge eklenemediği için tüm kutucuklar gri kaldı. Portalın belge denetimi henüz e-Defter belge türünü tanımıyor; bu da canlı e-Defter aktarımının olmadığını doğruluyor.
- Firma başına 3 satır kutucuk olduğundan 12 firmalık liste ~1.300 px uzunluğunda. Büyük portföyde çok uzun bir sayfa olur.

### Prototip sayfalar

| Mükellef Takip | Eworks 1 | Eworks 2 |
|---|---|---|
| Prototip sayfa yok; dış sistemi sahte olan sayfalarda sarı "Demo modu" şeridi | ~30 sayfa aynı: başlık, 4 sayaç (0), filtre çubuğu, "Aradığınız kayıt bulunamadı.", "Yeni kayıt". "Henüz geliştirilmedi" işareti yok | = Eworks 1. Yeni e-Defter ekranı ise sarı uyarı ve pasif düğmeyle olgunluğunu açıkça gösteriyor |

## 5. Gezinme ve kabuk

| | Mükellef Takip | Eworks 1 | Eworks 2 |
|---|---|---|---|
| Ana menü | Sol kenar: 5 grup, 12 öğe; daraltılabilir, tercih tarayıcıda | Kenar menüsü tanımlı ama CSS ile gizli (`display:none!important`); kategori kartları ve geri düğmesi | = Eworks 1 |
| Hesap ve yardım | Kenar altında "Yardım" (okunmamış işareti) ve kullanıcı menüsü (Ayarlar, Kullanıcılar, Lisans, tema) | Üst çubukta takvim, bildirim, çıkış ve kullanıcı adı | = Eworks 1 |
| Konum bilgisi | Üst çubukta sayfa adı | "Eworks / Sayfa" yolu + sayfa başında "EWORKS / KATEGORİ" | = Eworks 1 (e-Defter'de "EWORKS / EWORKS / E-DEFTER" tekrar ediyor) |
| Arama | Komut paleti (Ctrl+K veya "/"): sayfa, işlem, mükellef | Üst çubukta sayfa ve firma arama | = Eworks 1 |
| Bir sayfaya ulaşmak | 1 tık | Ana sayfadan 2–3 tık ya da arama | = Eworks 1 |

## 6. Duyarlı tasarım (telefon, 375 px)

| | Mükellef Takip | Eworks 1 | Eworks 2 |
|---|---|---|---|
| Menü | Hamburger → sol çekmece; üst çubukta sayfa adı, arama simgesi, zil | Bileşenler alt alta; 380–1280 px arasında 14 kırılma noktası | = Eworks 1 + tablolar için 600 px kırılma noktası |
| Ana iş ekranı | İş kutusu tek sütun; sekmeler yatay kaydırılıyor (bilinçli) | GİB aktarım paneli ve düğmeler ilk ekranı dolduruyor | = Eworks 1 |
| Kayıt tabloları | Yatay kaydırma kabında; taşma/kırpılma ölçen arayüz testleri var (`apps/web/e2e/support.ts`) | e-Beyanname tablosunda Durum ve Detay sütunları ekran dışında; Detay'a ulaşmak için tablo içinde kaydırmak gerekiyor | Her satır etiketli bir karta dönüşüyor (İşlem/Belge, Mükellef, Dönem, Oluşturma, Durum, Detay); sayfa genişliği 375 px, taşma yok |
| e-Defter | — | Dönem ve ay kartları alt alta | Matris kendi alanında yatay kayıyor, firma sütunu sabit |
| Sabit şeritler | Yok | Alttaki sarı şerit içeriğin bir bölümünü sürekli örtüyor | = Eworks 1 |

## 7. Gözlenen görsel sorunlar

| # | Sorun | Mükellef Takip | Eworks 1 | Eworks 2 | Etki |
|---|---|---|---|---|---|
| 1 | Üstteki durum şeridi üst çubuğun üstüne biniyor; logo ve kullanıcı adı yarı örtülü (1366 px) | — | Var | Var | Orta |
| 2 | Alttaki sabit şerit içeriği örtüyor | — | Var | Var | Orta |
| 3 | Prototip sayfalar çalışan modülden ayırt edilemiyor | — | Var (~30 sayfa) | Var (~30 sayfa) | Yüksek (yanlış beklenti) |
| 4 | Firma listesi ilk ekranın çok altında | — | Var | Var | Orta |
| 5 | Ana sayfa yalnız gezinme; günün işleri yok | — | Var | Var | Orta |
| 6 | Koyu tema yok | — | Var | Var | Düşük |
| 7 | Mükellef listesinde VKN/TCKN maskesiz | Var (şahıs TCKN dahil) | Var | Var (e-Defter matrisinde de) | Yüksek (KVKK; yeni yapıda `maskTaxId`) |
| 8 | Telefonda kayıt tablosunda Durum/Detay ekran dışında | — | Var | **Giderildi** | Orta |
| 9 | Firma listesinde sayfalama yok | Var (40 firma tek sayfa) | Var | Var; e-Defter matrisi de sayfalamasız | Düşük–orta |
| 10 | Beyanname çubuklarında anlam yalnız renkte (sayı sağda toplam) | Var | — | — | Düşük |
| 11 | Konum satırında "EWORKS / EWORKS" tekrarı | — | — | Var (e-Defter) | Düşük |

## 8. Yeni yapı için öneriler

Yeni portal (`apps/web`) Eworks 1'in akışlarını taşıdı. Görsel tarafta üç sürümden alınabilecekler:

**Mükellef Takip'ten:**

- kalıcı sol menü ve komut paleti (1 tıkla erişim),
- iş kutusunun liste + ayrıntı düzeni,
- sıkışık tablo yoğunluğu,
- koyu tema altyapısı,
- "Demo modu" gibi açık durum bildirimi.

**Eworks 1'den:**

- beyanname çekme ekranındaki yıl/ay seçicisi,
- firma satırındaki kurum durumu çipleri (G/S/V),
- zengin firma kartı ve kurum portalı kısayolları.

**Eworks 2'den:**

- telefonda tablo → etiketli kart dönüşümü,
- yalnız doğrulanmış belgeyi "var" sayan e-Defter matrisi (gri = kontrol edilmedi; "yok" ile karıştırılmıyor),
- canlı bağlantısı olmayan işlemde pasif düğme + açıklama: D30'daki "Geliştiriliyor" işaretine yakın bir yaklaşım.

**Üçünden de kaçınılacaklar:**

- içeriği örten sabit şeritler,
- prototip sayfayı çalışan sayfa gibi göstermek: yeni yapıda kırmızı `FeatureBadge` zorunlu (D30),
- maskesiz VKN/TCKN,
- sayfalamasız uzun listeler.

Yeni yapıda arayüz değişiklikleri dört ekran sınıfında (375 / 768 / 1366 / 1920) kabul testinden geçmeli ([../docs/ai/test.md](../docs/ai/test.md)).
