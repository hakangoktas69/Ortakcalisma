<!-- gezinti — node tools/docs/gezinti.mjs --yaz üretir, elle düzenlemeyin -->
[README](../../README.md) › [Genel bakış](../00-genel-bakis.md) › **Vizyon**
<!-- /gezinti -->

# Vizyon ve kapsam

> Kısa özet. Ayrıntı ve gerekçe: [hedef-mimari/01](../hedef-mimari/01-cok-kiracili-hedef-mimari.md).

## Kim için

- **Mali müşavir ofisleri** (kiracı = ofis). Ofiste birden çok **müşavir**, her müşavirin **personeli** ve **mükellef portföyü** vardır (D8).
- **Mükellefler** de portala girer; yalnız kendi firmalarını görür (D12).
- **Satış ekibi** ofis, müşavir ve mükellef hesaplarını ayrı satış portalından açar; kendi kendine kayıt yoktur (D27).
- Ölçek varsayımı: 500 ofis; örnek ofis 5 müşavir × 300 mükellef ≈ 1.505 kurum hesabı (D8, D26).

## Çözdüğü sorun

Müşavir her ay GİB ve SGK ekranlarını mükellef mükellef açıp beyanname, tahakkuk, e-Bildirge, işe giriş/çıkış, e-Rapor ve iş kazası bilgisini elle topluyor. Eworks bu veriyi **müşavirin ve mükelleflerin kendi kurum hesaplarıyla**, sunucu tarafında, **gece toplu ve tam otomatik** (D6, gece penceresi 20:00–09:00) ya da müşavirin talebiyle çeker; tek ekranda kontrol, görev ve uyarı olarak sunar.

## İlkeler

1. **Güven özellikten önce gelir.** Kurum şifresi, VKN/TCKN ve sağlık verisi işlenir; sızıntı ürünü bitirir.
2. **Web servis birincil, robot yedek** (D19). Kuruma giden istekler aralıklı ve sınırlıdır (D7, D25); kurum erişim denetimi atlatılmaz (D14).
3. **Kullanıcı tarafında kurulum yok** (D2, D3): masaüstü ajanı, eklenti, localhost köprüsü yok. Tarayıcıda gizli bilgi yok (D5).
4. **Mükellef onayı** olmadan müşavir mükellefin kurum bilgisini kullanmaz; mükellef müşavirin bilgisini hiç kullanamaz (D18).
5. **Görünür ilerleme:** tamamlanmamış her modül/sayfa/işlem geliştirme kipinde kırmızı görünür ve özellik durumu sayfasında izlenir; demo ve üretimde portal normal görünümündedir (D22, D39).
6. **Tutumlu kaynak:** büyük veri parçalı işlenir, her servis kaynak sınırlıdır (D9).

## Kapsam dışı

- Beyanname hazırlama/gönderme, bordro hesaplama, muhasebe.
- Kuruma yazan işlemler kullanıcı eylemi olmadan (zamanlanmış iş yalnız okur).
- Eski Eworks pilotunun verisini taşıma (D29) ve Mükellef Takip geliştirmesi (arşiv, D32).

## Barındırma

On-prem Supabase (D4), Türkiye'de; Docker Compose veya Kubernetes, kurulumda seçimli (D10).

<!-- gezinti — node tools/docs/gezinti.mjs --yaz üretir, elle düzenlemeyin -->

---

[README](../../README.md) › [Genel bakış](../00-genel-bakis.md) › **Vizyon**
<!-- /gezinti -->
