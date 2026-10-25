<!--
dev → main PR'ı (D37, kod sahibi @hkazaz). Açıklama, dev'e giren birleştirme commit'lerindeki A/B/C raporlarından derlenir
(git log --merges main..dev). Kişisel dal → dev birleşimi PR'sız yapılır: tools/ajan/birlestir.mjs.
Boş kalacak bölüme "yok" yazılır ve kısaca nedeni eklenir. Kişisel veri, sır, gerçek mükellef/müşavir bilgisi yazılmaz.
-->

## Ne değişti (iş diliyle)

<!-- Kim, ekranda neyi farklı görecek ya da yapabilecek? -->

**Kabul ölçütü:** <!-- Kullanıcı neyi görünce "oldu" der? Kim görür, kim göremez? -->

## A. Anlama

- Bağlam ve özellik anahtarı:
- İş modeli (rol, yetki anahtarı, firma kapsamı, mükellef onayı, kişisel veri, kuruma yazma):
- Değdiği açık konu ya da karar:

## B. Plan ve riskler

- Etki analizi (etkilenen bağlam, uç, tablo, ekran, sözleşme):
- Öngörülen hata durumları → testleri:
- Güvenlik notları:
- Yeni bağımlılık (ad, sabit sürüm, lisans, güvenlik açığı denetimi sonucu):
- Migration ve geri alma planı (mevcut veride ne olur, sorun çıkarsa ileri düzeltme):

## C. Doğrulama

- [ ] `pnpm verify` yeşil
- [ ] Yığın testleri (`node tools/deploy/yigin.mjs test`) — gerekmiyorsa nedeni:
- [ ] Kabul testleri dört ekranda + erişilebilirlik taraması (`node tools/deploy/yigin.mjs e2e`) — arayüz değişmediyse nedeni:
- [ ] Değişen ekranın 375 ve 1366 genişlikte görüntüsü incelendi, UX listesi uygulandı
- [ ] Bağımsız inceleme (Claude `code-review` / Codex `/review`); bulgular ve sonuçları:

Kırmızıdan yeşile dönen testler:

Koşulamayan doğrulama ve nedeni:

## Kıdemli onayı

<!-- Hassas alan listesi: `node tools/ajan/bitir.mjs` çıktısı (tools/ajan/ortak.mjs HASSAS_ALANLAR). -->

- [ ] Hassas alan değişmedi
- [ ] Hassas alan değişti (birleştirme mesajlarındaki "Kıdemli onayı gerekli" bölümleri), kod sahibi onayı gerekli:

## Elle bakılacak yer

<!-- Ekran yolu, demo hesabı, denenecek adımlar. -->
