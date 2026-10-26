# Ekip için devam rehberi

Kapsam: `mert/eworks/`.

## Git / Sourcetree

26 Ekim 2026 itibarıyla kullanıcı eski Git Flow akışını kaldırdı.

1. Çalışma dalı `mert/eworks-ikinci-entegrasyon`. Kod değişikliklerini küçük, bağımsız commitler halinde burada hazırlayın.
2. Yalnız ikinci entegrasyonu ve kendi dokümanlarını değiştirin; ilk entegrasyon arşivi ve tarihsel dalı korunur.
3. Sır/kişisel veri denetimi ve ilgili kontrollerden sonra commit ve yalnız kişisel dala push yapın.
4. Git Flow feature start/finish kullanmayın. `dev`/`main` dallarına merge veya push yapmayın. Ekip sorumlusu kodu yeni yapıya kendisi uyarlayacak.
5. Daha önce `dev`e gönderilmiş commitleri geri almayın; mevcut geçmişi değiştirmeyin ve force push yapmayın.

## Canlı işe devam etmeden önce

Paylaşılan kod şablonlarla gelir; kurulum rehberini tamamlayın. Gerçek müşteri aktarımı için özel ortam sahibinin hesabı ve yetkisi gerekir. Başkasının tokenını veya yerel `.env` dosyasını kopyalamayın.

Genel aktarım şu an durdurulmuş durumdadır. Devam talebi verilirse önce özel ortamda son hedef, eski checkpoint'ler ve son belge tekrarının kaydedilmiş sonuçları birlikte incelenmeli; tamamlanmış kapsam yeniden hesaplanmalıdır. Sınırlı belge tekrarını tam firma/ay taraması saymayın. Ardından sadece eksik Temmuz–Ağustos kapsamını hazırlayın. Kaynakta kayıt yok, belge sunulmuyor, geçerli sözleşme yok ve teknik hata ayrımını koruyun.

Süre azalırsa yeni belge isteği başlatılmaz. HTTP 401/403 veya 429 halinde durma davranışını kaldırmayın. Yeni GİB oturumunda kullanılan aracın CAPTCHA/onay kuralını izleyin. Her bölümden sonra sadece dosyanın indirildiğini değil özel depo geri okumasını ve portalın kaydı doğruladığını da kontrol edin.

## Paylaşım kapsamı

Bu paket çalışan özel ortamın kopyalanabilir veritabanı yedeği değildir. Kurulum SQL'leri ve kaynaklar bulunur; gerçek kayıt/PDF/şifre/checkpoint yoktur. Yeni bilgisayarda eski canlı işi devam ettirmek için bu eksik özel kanıtların yetkili kanaldan sağlanması gerekir.
