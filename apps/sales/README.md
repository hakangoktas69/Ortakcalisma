# apps/sales — satış portalı

Satış ekibinin müşavir ofisi açtığı ayrı uygulama (port 8081, turuncu tema). Müşavirler bu portalı görmez. Kurallar ve bağlam: [CLAUDE.md](CLAUDE.md), [sales bağlamı](../../docs/baglamlar/sales.md).

| Ekran | İş |
|---|---|
| Giriş (`/giris`) | Önce e-posta, sonra parola. İki adımlı doğrulaması kapalı hesapta resimdeki güvenlik kodu da istenir; açık hesapta parolanın ardından telefondaki kod. Geçici parolayla girilirse önce parola değiştirilir. |
| Ofisler (`/`) | Tüm ofisler: yetkili, telefon, paket, durum (deneme / aktif / süresi doldu / donduruldu / süresiz), lisans bitişi. Arama ve durum süzgeci. |
| Yeni ofis (`/yeni`) | Ofis adı, müşavirin adı soyadı, e-posta, telefon, paket, deneme süresi (varsayılan 14 gün). Ofis + yönetici müşavir + deneme lisansı birlikte açılır; geçici parola **bir kez** gösterilir. |
| Parola ve güvenlik (`/sifre`) | Kendi parolasını değiştirme; iki adımlı doğrulamayı açma (QR, kurtarma kodları bir kez gösterilir) ya da kapatma (parola + kod). Diğer oturumlar kapanır. |

İlk satış kullanıcısı (sonrakiler "Satış ekibi" ekranı gelince oradan):

```bash
node tools/deploy/yigin.mjs satis-kullanici --eposta ad.soyad@firma.com --ad "Ad Soyad"
```
