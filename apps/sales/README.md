# apps/sales — satış portalı

Satış ekibinin müşavir ofisi açtığı ayrı uygulama (port 8081, turuncu tema). Müşavirler bu portalı görmez. Kurallar ve bağlam: [CLAUDE.md](CLAUDE.md), [sales bağlamı](../../docs/baglamlar/sales.md).

| Ekran | İş |
|---|---|
| Giriş (`/giris`) | E-posta + parola → iki adımlı doğrulama (zorunlu; ilk girişte QR ile kurulur, kurtarma kodları bir kez gösterilir). Geçici parolayla girilirse önce parola değiştirilir. |
| Ofisler (`/`) | Tüm ofisler: yetkili, telefon, paket, durum (deneme / aktif / süresi doldu / donduruldu / süresiz), lisans bitişi. Arama ve durum süzgeci. |
| Yeni ofis (`/yeni`) | Ofis adı, müşavirin adı soyadı, e-posta, telefon, paket, deneme süresi (varsayılan 14 gün). Ofis + yönetici müşavir + deneme lisansı birlikte açılır; geçici parola **bir kez** gösterilir. |
| Parola (`/sifre`) | Kendi parolasını değiştirme; diğer oturumlar kapanır. |

İlk satış kullanıcısı (sonrakiler "Satış ekibi" ekranı gelince oradan):

```bash
node tools/deploy/yigin.mjs satis-kullanici --eposta ad.soyad@firma.com --ad "Ad Soyad"
```
