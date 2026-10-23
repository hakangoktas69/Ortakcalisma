# 3.5 Tuzaklar

> Önce: [Test](04-test.md) · İlgili: [Güvenlik riskleri](../04-eksikler-ve-riskler/02-guvenlik-riskleri.md)

| # | Tuzak | Belirti | Doğrusu |
|---|---|---|---|
| 1 | Supabase sabitleri üç yerde | Portal çalışır, robot 401 alır (veya tersi) | HTML, `cloud_credentials.py`, `.env` birlikte güncellenir; commit edilmez |
| 2 | Belgeler kodun gerisinde | `Kullanim.md` "CAPTCHA'yı siz girin" der, robot kendisi giriş yapar | Davranış için kodu esas alın (`auto_login=True`); belgeyi düzeltin |
| 3 | Sayfa yenileme oturumu düşürür | Kayıt kuyruğu kaybolur | Kayıt bitmeden sekmeyi kapatmayın/yenilemeyin; hata çubuğundaki JSON yedeğini kullanın |
| 4 | Revision çakışması (`40001`) | "Revision conflict; reload before saving" | İki sekme/cihazda aynı kullanıcı açık; birini kapatıp yeniden yükleyin |
| 5 | 5 MB payload tavanı | `Invalid state` | Büyük veriyi payload'a koymayın (bkz. tarif T2) |
| 6 | Tek iş kuralı | İkinci "Güncelle" reddedilir | Önceki iş bitene/iptal olana kadar bekleyin |
| 7 | Hot-reload | Robot çalışırken dosyayı kaydettiğinizde davranış iş ortasında değişir | Canlı oturumda adaptör dosyalarını düzenlemeyin |
| 8 | `runtime/` klasörü `sys.path` başında | Beklenmeyen `xlrd` sürümü yüklenir | `runtime/` klasörü oluşturmayın; [G-08](../04-eksikler-ve-riskler/02-guvenlik-riskleri.md#g-08) |
| 9 | `jobs/` birikir | Disk dolar, eski VKN/TCKN listeleri kalır | Elle temizleyin; temizlik görevi eklenene kadar |
| 10 | Yönlendirme onayı eski İVD oturumlarını kapatır | Kullanıcının açık GİB sekmesi düşer | Kullanıcıyı önceden uyarın (`GIB-Canli-Akis.md` adım 4) |
| 11 | JWT yenilenmez | 1 saatten uzun beyanname senkronunda Storage yüklemesi 401 | Kapsamı küçük tutun; kalıcı çözüm: robot için yenilenebilir kimlik |
| 12 | `gib_sozlesmeler-kurulum.sql` idempotent değil | İkinci çalıştırmada "policy already exists" | Yalnız eski CLI içindir; portal için gerekmez |
| 13 | Kaynaktan silinen firma | Portalda kalır | Bilinçli; silme elle yapılır |
| 14 | Windows yolları | Linux'ta OCR alt süreci bulunamaz | `.ocr-venv/Scripts/python.exe` sabit; platforma göre `bin/python` gerekir |
| 15 | `str(exc)` kullanıcıya gider | GİB/Supabase hata metni arayüzde görünür | Yeni kodda kullanıcıya sabit Türkçe mesaj, ayrıntıyı maskeli tanılamaya yazın |
| 16 | Depodaki kod ≠ çalışan kod | Sahadaki davranışı yeniden üretemezsiniz | Mert'e sürümü sorun; `SOURCE-MANIFEST.json` özetleriyle karşılaştırın |
