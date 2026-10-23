# Mükellef Takip — Yönetici Özeti (Executive Analysis)

> Kaynak: `hakan/mukellef-takip` (commit `64e3a49`, 19.10.2026). Bu belge kod tabanı ve proje README'si incelenerek hazırlanmıştır.

## 1. Ürün nedir?

**Mükellef Takip**, mali müşavir bürolarının mükelleflerine ait yasal yükümlülükleri (beyanname, e-Defter, SGK, e-Tebligat, bordro, fatura) tek ekrandan izlemesini sağlayan, çok kiracılı (her büro ayrı) bir web portalıdır. Satış modeli **firma kotasına dayalı abonelik**tir.

Temel değer önerisi:

- **"Bugün ne yapmalıyım?" sorusuna tek cevap:** İş kutusu; geciken/yaklaşan beyannameler, incelenmemiş tebligatlar, onay bekleyen e-raporlar, e-Defter beratları ve bordro uyuşmazlıklarını otomatik listeler.
- **Süre kaçırma riskini azaltır:** Son günler kurallarla hesaplanır, her sabah hatırlatıcı (uygulama içi + WhatsApp) gönderilir.
- **Şifre paylaşmadan veri aktarımı:** Chrome eklentisi, müşavirin kendi açtığı GİB/SGK sayfasındaki tabloyu okur; GİB şifresi portalda saklanmaz.

## 2. Modüller ve olgunluk durumu

| Modül                              | İşlev                                                         | Durum                                                                |
| ---------------------------------- | ------------------------------------------------------------- | -------------------------------------------------------------------- |
| Giriş güvenliği, kullanıcılar, 2FA | Rol yönetimi, hesap kilidi, TOTP, büro geneli 2FA zorunluluğu | ✅ Tamam                                                             |
| Firmalar + Excel/CSV aktarım       | Toplu firma yükleme, önizleme, doğrulama                      | ✅ Tamam                                                             |
| e-Beyanname kontrolü               | Yükümlülük matrisi, son gün, durum (verildi/gecikti)          | ✅ Demo + eklentiyle aktarım · ⏳ gerçek GİB sayfasında doğrulanmadı |
| e-Tebligat                         | Eklentiyle aktarım, tebliğ sayılma tarihi (VUK 107/A)         | ✅ · ⏳ gerçek sayfada doğrulanmadı                                  |
| SGK Vizite (e-Rapor)               | Resmi SOAP servisi, gece senkronu, onay                       | ✅ Demo · ⏳ canlı SGK'da denenmedi                                  |
| SGK 4A işe giriş/çıkış             | Okuma                                                         | ✅ Demo · ❌ canlı istemci yok (SGK kılavuzu bekleniyor)             |
| SGK e-Bildirge                     | Eklentiyle aktarım                                            | ✅ · ⏳ sütun başlıkları doğrulanmadı                                |
| e-Defter berat takibi              | Son günler, hatırlatıcı                                       | ✅ (Ekim–Aralık dönemi elle)                                         |
| Faturalar + KDV ön kontrol         | UBL-TR XML/ZIP aktarımı, satış/alış eşleştirme                | ✅ · ❌ entegratör API'si yok                                        |
| Bordro + e-Bildirge mutabakatı     | Excel/CSV aktarımı, satır kontrolleri                         | ✅ · ⏳ gerçek bordro çıktısıyla denenmedi                           |
| Bildirimler + WhatsApp             | Zil, sabah hatırlatıcıları, Meta Cloud API                    | ✅ Demo · ⏳ canlı Meta hesabı yok                                   |
| Raporlar (CSV), Dilekçeler         | 6 hazır şablon + büro şablonları                              | ✅ Tamam                                                             |
| Lisans ve ödeme (iyzico)           | Paket, kota, ödeme formu                                      | ✅ **Sandbox'ta uçtan uca doğrulandı** · ❌ canlı üye işyeri yok     |
| Uzmana Sor (AI asistan)            | Claude API, kişisel veri maskeleme, günlük kota               | ✅ Demo · ⏳ gerçek anahtarla denenmedi                              |

**Özet:** Fonksiyonel kapsam geniş ve büyük ölçüde tamamlanmış durumda (yol haritasında 12 faz tamam). Ancak **dış sistemlerle canlı doğrulama** (GİB, SGK, WhatsApp, iyzico canlı, Claude API) hiçbir modülde henüz yapılmadı. Ürün "özellik-tamam demo" aşamasındadır, "üretime hazır" değildir.

## 3. Ölçek ve yatırım göstergeleri

| Gösterge                | Değer                                |
| ----------------------- | ------------------------------------ |
| Backend kodu (NestJS)   | ~9.500 satır                         |
| Frontend kodu (Next.js) | ~8.800 satır                         |
| Veritabanı              | 30+ tablo, 18 migration              |
| Otomatik test           | 18 test dosyası, ~115 test senaryosu |
| Ekran sayısı            | 18 panel sayfası                     |

Tek geliştirici tarafından yaklaşık **8 günde** (12–19 Ekim 2026, migration tarihlerine göre) üretilmiş; bu, yapay zekâ destekli yoğun bir geliştirme temposuna işaret eder.

## 4. Gelir modeli (örnek fiyatlar)

| Paket     | Firma kotası | Aylık (KDV dahil) |
| --------- | ------------ | ----------------- |
| Başlangıç | 50           | 750 TL            |
| Pro       | 150          | 1.500 TL          |
| Kurumsal  | 500          | 3.500 TL          |

6 ay peşin %5, 12 ay peşin %15 indirim. **Fiyatlar kodda "örnek" olarak işaretlidir**; pazar araştırmasıyla netleştirilmelidir.

## 5. Güçlü yönler

1. **Güvenlik bilinci yüksek:** Kurum şifreleri AES-256-GCM ile şifreli, her erişim denetim kaydında; 2FA, hesap kilidi, oturumların anında düşürülmesi; ödeme tutarı sunucuda hesaplanır, kart bilgisi sunucuya gelmez.
2. **Hukuki/regülasyon riskine duyarlı tasarım:** 4A bildirge _gönderimi_ bilinçli olarak eklenmemiş (yasal bağlayıcılık); AI asistanı portal verisine erişemez ve kişisel verileri maskeler; şablonlarda "kontrol edilmeli" uyarısı.
3. **Şifresiz entegrasyon yaklaşımı (eklenti):** GİB şifresi istemeden veri almak hem güven hem KVKK açısından satış argümanıdır.
4. **Kaynaktan bağımsızlık:** Fatura (UBL-TR) ve bordro aktarımı belirli bir entegratöre/programa bağlı değil.
5. **Dokümantasyon:** README; her modülün kaynağını, kuralını ve _doğrulanmamış_ noktalarını açıkça yazıyor.

## 6. Riskler ve açık noktalar

| Risk                                                  | Etki                                                   | Öneri                                              |
| ----------------------------------------------------- | ------------------------------------------------------ | -------------------------------------------------- |
| Hiçbir dış entegrasyon canlıda doğrulanmadı           | Yüksek — ilk müşteride beklenmedik hata                | Pilot büro + pilot işyeri ile kontrollü canlı test |
| GİB/SGK sayfa yapısı değişirse eklenti tanıyamaz      | Orta — başlık kalıpları sunucuda, hızlı düzeltilebilir | İzleme + hızlı yama süreci                         |
| Resmi tatiller ve GİB süre uzatımları takvimde yok    | Orta — yanlış "gecikti" uyarısı                        | Resmi takvim kaynağı eklenmeli                     |
| KVKK: AI sorularının yurt dışına aktarımı             | Yüksek (yasal)                                         | Aydınlatma metni ve sözleşme güncellemesi          |
| Canlı altyapısı yok (sunucu, https, yedekleme, CI/CD) | Yüksek                                                 | Yayın ortamı planı                                 |
| iyzico canlı üye işyeri başvurusu yapılmadı           | Gelir alınamaz                                         | Başvuru süreci başlatılmalı                        |
| Tek geliştirici bağımlılığı                           | Orta                                                   | Ortak çalışma deposu ile bilgi paylaşımı (bu depo) |

## 7. Ekipteki diğer çalışmayla ilişki

Aynı depoda `mert/eworks` (Supabase + Python/Playwright robotu ile GİB otomasyonu) bulunmaktadır. İki proje GİB verisine **farklı yaklaşımlarla** ulaşıyor:

- **Mükellef Takip:** Kullanıcının açtığı sayfayı okur, şifre saklamaz, GİB'e istek atmaz (düşük hukuki risk, manuel tetikleme).
- **Eworks:** Robot ile otomatik giriş ve gezinme (yüksek otomasyon, şifre saklama ve GİB kullanım koşulları riski).

Ortak bir ürün stratejisi için bu iki yaklaşımın konumlandırılması (hangisi hangi müşteri segmentine) netleştirilmelidir.

## 8. Önerilen sonraki adımlar (öncelik sırasıyla)

1. **Pilot büro seçimi** ve GİB/SGK sayfalarında eklentinin gerçek doğrulaması (Faz 3c, 4-canlı, 5b).
2. **Canlı ortamı:** sunucu, https, yedekleme, izleme, CI/CD.
3. **KVKK paketi:** aydınlatma metni, kullanıcı sözleşmesi, yurt dışı aktarım onayı.
4. **iyzico canlı başvurusu** ve gerçek fiyatlandırma kararı.
5. Resmi tatil / süre uzatımı takvimi.
6. SGK canlı Vizite pilotu; 4A kılavuzu için SGK başvurusu.
