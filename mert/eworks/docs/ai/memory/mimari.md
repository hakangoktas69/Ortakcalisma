# Mimari ve kod haritası

Kapsam: `mert/eworks/entegrasyon-2-servis/`.

## İki yöntem

İlk sürüm Playwright ile Chrome'daki giriş, sözleşme ve e-Beyanname liste akışını yürütür. İkinci sürüm bu akışı korur; gözlenen ve kapsamı doğrulanan liste/PDF isteğini aynı tarayıcı oturumunun HTTP istemcisiyle taşır. HTTP cevabı mevcut tarayıcı okuyucusuna döndürülür; satır, tarih, sayfalama ve belge-kayıt kontrolleri yine uygulanır.

Girişte geçici oturum tokenı alınabilir. Bu token süresiz bir entegrasyon anahtarı değildir; kullanıcı ve oturum kapsamındadır. Token ve şifreler paylaşım hafızasına veya Git'e konmaz.

## Bileşenler

| Dosya | Sorumluluk |
|---|---|
| `Eworks-Portal/eworks-tasarim.html` | Supabase oturumu, seçimler, iş takibi, doğrulanmış sonuçların portal kaydı |
| `Eworks-Portal/yerel-sunucu.py` | Yalnız localhost köprüsü; hesap doğrulaması ve işe özel Python alt süreci |
| `Eworks-Portal/institution-review.js` | Kaynak kapsamı, sahiplik, ek dosya ve mevcut kayıtlarla birleştirme kontrolleri |
| `portal_worker.py` | Playwright yaşam döngüsü, Vault bilgileri, canlı sözleşmeler, sorgu ve belge toplayıcı |
| `cloud_credentials.py`, `firm_credentials.py` | Eworks kullanıcısına bağlı Supabase/Vault aracı |
| `institution_discovery.py`, `declaration_sync.py`, `declaration_reader.py` | Gözlenen ekranlar, seçilen firma/tarih kapsamı, sayfalama ve checkpoint |
| `service_transport.py` | Aynı oturumda sınırlı HTTP taşıma; otomatik HTTP retry yok, kaynak hata kodu/aşaması korunur |
| `declaration_service.py`, `network_probe.py` | Tarayıcı/servis liste sonuçlarının salt okunur karşılaştırılması; PDF indirme ve portal yazımı yok |
| `network_observer.py` | İzinli alan adları, alan isimleri ve veri türlerinin şeması; ham değer/token kaydetmez |
| `declaration_document_adapter.py`, `declaration_documents.py` | Görünür kayda bağlı PDF kontrolü, PDF doğrulaması, özel depoya yükleme ve hash geri okuması |
| `muhsgk_sgk_reader.py`, `muhsgk_sgk_adapter.py` | MUHSGK içindeki SGK tahakkuk ve hizmet belgeleri |
| `sgk_employee_count.py` | Hizmet listesindeki tekil kişilerden kanıtlı çalışan sayısı |
| `session_guard.py`, `integration_errors.py` | Oturum bütçesi ve ayrıştırılmış hata sınıfları |
| `bulk_resume.py` | Aynı hesaba/kapsama ait tamamlanmış checkpoint'lerden açık devam |
| `document_retry.py` | Önceki belge hatalarının kimlik+kayıt kapsamına bağlı sınırlı tekrarı; tam tarama kapsamı sayılmaz |
| `local_ocr.py`, `local_ocr_worker.py`, `captcha_assist.py` | Yerel OCR alt süreci ve giriş yardım akışı; araç kuralları ayrıca geçerlidir |

## Veri saklama ve sınırlar

Portal kayıtları Supabase veritabanında, PDF'ler özel `eworks-declarations` Storage alanında tutulur. Dosya yolu sahip/kayıt/tür/içerik özetiyle bağlanır; erişim, RLS/Vault/Edge Function yapılandırmasına dayanır. Yerel `jobs/` klasörü özel iş gözlemleri, checkpoint ve bazı geçici SGK dosyalarını içerir; Git'e dahil edilmez.

E-Defter menüsünün bulunması tamamlanmış canlı e-Defter aktarımı değildir. İkinci servis yolu resmî ve bağımsız bir GİB API ürünü olarak tanımlanmamalıdır. Pilotun bulut sunucuda kesintisiz çalışması veya üretime hazır olduğu doğrulanmadı.
