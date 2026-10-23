# 2.5 Mimari kararlar (geriye dönük)

> Önce: [Güvenlik mimarisi](04-guvenlik-mimarisi.md) · İlgili: [Eksikler](../04-eksikler-ve-riskler/01-mimari-yapisal-eksikler.md)

Eworks'te yazılı ADR yoktur. Aşağıdaki kayıtlar koddan ve kullanıcı belgelerinden **çıkarılmıştır**; "Durum" sütunu bu belgenin önerisidir, ekip kararı değildir. Yeni karar alındığında aynı biçimde bu dosyaya `K-NN` eklenir.

| # | Karar | Gerekçe (gözlenen) | Sonuç / bedel | Durum önerisi |
|---|---|---|---|---|
| K-01 | Uygulama sunucusu yok; Supabase BaaS + statik HTML | Tek geliştirici, hızlı pilot, barındırma maliyeti yok | İş kuralları tarayıcıda; sunucu tarafında doğrulama yalnız SQL'de | Pilot için uygun; ürün için gözden geçir |
| K-02 | Kullanıcı başına tek JSONB belge + revision | Basit eşitleme, şema göçü gerekmez, çevrimdışı düzenleme kolay | 5 MB tavan, sorgulanamaz, tüm belge yeniden yazılır, çok kullanıcı yok | **Değiştir** (ilişkisel model) — [M-02](../04-eksikler-ve-riskler/01-mimari-yapisal-eksikler.md) |
| K-03 | Robot veritabanına yazmaz, sonucu portal kaydeder | Robota yazma yetkisi vermemek; kullanıcı gözetimi | Kayıt için sekmenin açık kalması gerekir; PDF'lerde istisna | **Koru** |
| K-04 | Yerel köprü (localhost HTTP + subprocess) | Tarayıcıdan Python/Chrome başlatmanın en basit yolu | Yalnız tek makine, tek iş, Windows | Pilot için uygun |
| K-05 | Görünür Chrome, kullanıcının bilgisayarında | CAPTCHA, GİB'in bot korumaları, kullanıcı gözetimi | Sunucuya taşınamaz, ölçeklenmez | Koru (uyum gereği) |
| K-06 | GİB şifresi Vault'ta, tarayıcı geri okuyamaz | Şifreyi her seferinde yazdırmamak, tarayıcı sızıntısını sınırlamak | Robot JWT ile şifreyi düz metin alır | **Gözden geçir** — [G-02](../04-eksikler-ve-riskler/02-guvenlik-riskleri.md#g-02) |
| K-07 | CAPTCHA'yı yerel OCR ile çöz ve tek seferlik otomatik giriş yap (`8cb6397`) | Kullanıcı zahmetini azaltmak | GİB kullanım koşulları / Mükellef Takip kural #3 ile çelişki | **Geri al veya hukuki onay** — [G-01](../04-eksikler-ve-riskler/02-guvenlik-riskleri.md#g-01) |
| K-08 | Sonuçlar sürümlü JSON şemaları (`eworks.gib.contracts.v1`, `eworks.declarations.sync.v1`) | Köprü/robot ayrımı, doğrulama | Şema yazılı değil, kod içinde | **Koru + JSON Schema yaz** |
| K-09 | PDF'ler içerik adresli (SHA-256), değiştirilemez | Bütünlük, tekrar yüklemeyi önleme | Silme/KVKK imha akışı yok | Koru + imha akışı ekle |
| K-10 | supabase-js kullanmadan çıplak `fetch` | Bağımlılık/derleme yok | Yenileme, hata eşleme elle | Ön yüz yeniden yazılırsa bırak |
| K-11 | Build adımı olmayan tek dosya ön yüz | Kopyala-çalıştır dağıtım | 244 KB, test/lint/tip yok | **Değiştir** — [M-01](../04-eksikler-ve-riskler/01-mimari-yapisal-eksikler.md) |
| K-12 | Çalışma anında navigasyon adaptörlerini yeniden yükleme (`importlib.reload`) | GİB ekranı değişince robotu kapatmadan düzeltmek (geliştirme kolaylığı) | Çalışan oturuma kod enjeksiyonu yüzeyi | Üretimde kapat — [G-08](../04-eksikler-ve-riskler/02-guvenlik-riskleri.md#g-08) |
