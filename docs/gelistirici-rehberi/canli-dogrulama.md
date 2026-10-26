# Canlı GİB doğrulaması (D33)

Kurumla konuşan işlemler (`live: true`) sahte GİB testleri geçse de **canlı koşu kaydı** girilene kadar kırmızıdır ([test.md](../ai/test.md), K-40). Bu belge canlı koşunun nasıl yapılacağını ve kaydın nasıl girileceğini anlatır. Canlı koşuyu **Hakan kendi GİB hesabıyla** yapar; Claude/Codex oturuma katılabilir ama şifreyi görmez.

## Bugün canlı doğrulama bekleyen işlemler

| Anahtar | Ekran | Ne doğrulanır |
|---|---|---|
| `firmalar.gib_sozlesmeler.sync` | Firmalarım → GİB e-Beyanname sözleşmeleri → "GİB'den güncelle" | Giriş (otomatik güvenlik kodu), İVD yönlendirme onayı, menü, "Tümünü Göster", alt bilgi toplamının okunan satırla eşleşmesi |
| `beyanname.senkron.start` | e-Beyanname → Beyanname senkronu | e-Beyanname kartı + yönlendirme onayı, "Beyanname Ara" formu, sayfalama, beyanname/tahakkuk PDF'leri |
| `sgk.ebildirge.sync` | SGK → e-Bildirge → Toplu güncelle | MUHSGK "SGK Bildirimleri" penceresi, SGK tahakkuk + hizmet listesi PDF'leri, çalışan sayısı |

Diğer canlı işlemler (`tebligat.liste.sync`, `sgk.ise_giris_cikis.sync`, `sgk.erapor.*`, `sgk.is_kazasi.sync`) henüz yazılmadı; kırmızı kalır.

## Hazırlık

1. Güncel dalı çek, yığını kur: `node tools/deploy/yigin.mjs up`.
2. `deploy/compose/.env` dosyasına ekle (gitignore'dadır, commit edilmez):

   ```
   GIB_SAHTE_SUNUCU=
   GIB_ISTEK_DK=30
   GIB_ERISIM_YOLU=servis
   ```

   Boş `GIB_SAHTE_SUNUCU` robotu gerçek GİB'e yönlendirir. `GIB_ERISIM_YOLU` hangi erişim yolunun doğrulandığını belirler (D38; `servis` varsayılandır, `robot` ayrıca koşulabilir); kayıttaki `sonuc` alanına yolu yaz. 30 istek/dk, pilot hızının yarısıdır (D25); ilk koşuda temkinli kalır. Ardından yeniden `node tools/deploy/yigin.mjs up` (servisler yeni ayarla yeniden kurulur).
3. Çıkış IP'si: robot bu makinenin IP'siyle çıkar (D14). Kurumun alışılmadık bulabileceği bir ağdan (yurt dışı VPN gibi) koşma.
4. Portala gir: `http://localhost:8080`, demo hesabı `DEMO_EPOSTA` / `DEMO_SIFRE` (değerler `.env`'de).
5. Firmalarım → Kurum hesapları → **Müşavir GİB hesabı**: kendi GİB kullanıcı kodun ve şifren. Şifre yalnız Vault'a gider.

## Koşu

Sırayla, her biri bitince sonucu GİB ekranıyla karşılaştır:

1. **Sözleşmeler:** "GİB'den güncelle". Bitince durum satırındaki sözleşme sayısı, GİB'deki "Geçerli E-Beyanname Sözleşmeleri Listesi" alt bilgisindeki toplamla aynı olmalı. Eski robot 17.10.2026'da 274 sözleşmeyle doğrulanmıştı.
2. **Beyanname:** tek bir mükellef ve tek bir ay seç. Listedeki beyanname sayısı ve türleri GİB'de aynı sorguyla görünenle aynı olmalı. En az bir beyanname PDF'ini aç.
3. **SGK:** aynı mükellef ve ay için "SGK bildirimlerini güncelle". İşyeri ve dönem GİB'deki MUHSGK → SGK bildirimleriyle eşleşmeli. Çalışan sayısı hizmet listesindeki kişi sayısı olmalı.

Bir adım başarısız olursa iş satırında Türkçe hata görünür. `docker compose -p eworks logs integration worker` günlüklerinde kişisel veri ve şifre yoktur; yalnız olay ve hata türü. Günlüğü paylaşmadan önce yine de gözden geçir. Güvenlik kodu çözülemezse iş 6 denemeden sonra durur. Sorunu `docs/ai/durum.md`'ye açık konu olarak yaz.

## Kayıt

Başarılı her işlem için `packages/feature-registry/canli-dogrulamalar.json` dosyasına bir kayıt ekle:

```json
[
  {
    "anahtar": "firmalar.gib_sozlesmeler.sync",
    "tarih": "2026-10-26T21:40:00+03:00",
    "kim": "Hakan",
    "sonuc": "Toplam GİB alt bilgisiyle eşleşti (sözleşme sayısı yazılabilir; unvan/VKN yazılmaz)",
    "surum": "<git rev-parse --short HEAD>"
  }
]
```

`sonuc` alanına kişisel veri (unvan, VKN/TCKN, ad) yazma; yalnız sayı ve eşleşme bilgisi. Ardından özellik durumunu üret ve commit et:

```bash
docker run --rm -v "$PWD":/src -w /src node:24.11.0-bookworm-slim node tools/features/uret.ts
git add packages/feature-registry docs/ozellik-durumu.md README.md && git commit -m "Canlı doğrulama: <anahtar>"
```

## Sonrası (KVKK)

Canlı koşudan sonra yerel veritabanında **gerçek mükellef verisi** ve S3'te gerçek PDF'ler bulunur. Bunlar bu makineden çıkmamalı:

- İş bitince `GIB_SAHTE_SUNUCU` satırını `.env`'den sil (sahte GİB'e geri dön).
- Gerçek veriyi sil: `node tools/deploy/yigin.mjs down --sil` (tüm birimler silinir), sonra `node tools/deploy/yigin.mjs up` ile temiz demo.
- `test-results/`, ekran görüntüsü ve günlük dosyalarını commit etme (kural 9).
