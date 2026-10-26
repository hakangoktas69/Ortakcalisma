# Ekip için devam rehberi

Kapsam: `mert/eworks/`.

## Git / Sourcetree

1. Kaydedilmemiş çalışmaları commit/stash ile koruyun. `dev` dalına geçip `Pull` ile güncelleyin.
2. Git Flow ayarlarında production=`main`, development=`dev`, feature prefix=`feature/` kullanın. Varsayılan `develop` ayrı bir dal olarak açılmamalı.
3. `Git Flow → Start New Feature` ile işe özel dal açın. İkinci entegrasyonu yalnız kendi dizininde değiştirin; ilk entegrasyonu arşiv olarak koruyun.
4. Kodla birlikte güncel durum ve çalışma günlüğünü de güncelleyin. Dosyaları sır/kişisel veri kontrolünden geçirin, ilgili testleri çalıştırın ve commit oluşturun.
5. Bitirmeden önce uzaktaki `dev` güncellemelerini alın ve feature dalına birleştirin. Çakışmaları çözün, etkilenen testleri tekrar çalıştırın.
6. `Finish Feature`, işi yerel `dev` dalına birleştirir. Ardından `dev` dalını push edin. Koruma kuralı varsa aynı feature'dan `dev` hedefli PR kullanın; force push yapmayın.

## Canlı işe devam etmeden önce

Paylaşılan kod şablonlarla gelir; kurulum rehberini tamamlayın. Gerçek müşteri aktarımı için özel ortam sahibinin hesabı ve yetkisi gerekir. Başkasının tokenını veya yerel `.env` dosyasını kopyalamayın.

Genel aktarım şu an durdurulmuş durumdadır. Devam talebi verilirse önce özel ortamda son hedef, eski checkpoint'ler ve son belge tekrarının kaydedilmiş sonuçları birlikte incelenmeli; tamamlanmış kapsam yeniden hesaplanmalıdır. Sınırlı belge tekrarını tam firma/ay taraması saymayın. Ardından sadece eksik Temmuz–Ağustos kapsamını hazırlayın. Kaynakta kayıt yok, belge sunulmuyor, geçerli sözleşme yok ve teknik hata ayrımını koruyun.

Süre azalırsa yeni belge isteği başlatılmaz. HTTP 401/403 veya 429 halinde durma davranışını kaldırmayın. Yeni GİB oturumunda kullanılan aracın CAPTCHA/onay kuralını izleyin. Her bölümden sonra sadece dosyanın indirildiğini değil özel depo geri okumasını ve portalın kaydı doğruladığını da kontrol edin.

## Paylaşım kapsamı

Bu paket çalışan özel ortamın kopyalanabilir veritabanı yedeği değildir. Kurulum SQL'leri ve kaynaklar bulunur; gerçek kayıt/PDF/şifre/checkpoint yoktur. Yeni bilgisayarda eski canlı işi devam ettirmek için bu eksik özel kanıtların yetkili kanaldan sağlanması gerekir.
