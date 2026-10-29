# Demo modu — eksik işlemlerin tamamlanması ve test sonucu

29 Ekim 2026. Bu işlemler **8080 ana Eworks portalına** aittir; 8081 satış portalı değiştirilmemiştir.

## Güncel durum

Önceki denetimde bulunan dört eksik işlem, gerçek veri ve kurum çağrısı kullanmadan tamamlandı.

| İşlem | Demo davranışı |
| --- | --- |
| Firma arşivleme | Firma silinmez; aktif listeden arşiv görünümüne taşınır. Firma durumu süzgecinden Arşivde seçilerek bulunur ve geri getirilebilir. Örnek belgeleri ve önceki firma bilgileri korunur. |
| Kurum hesabı kullanım izni | Örnek mükellef onayından sonra verilebilir. Geri alınabilir; arşivleme veya onayı geri alma demo iznini kaldırır. Gerçek kurum erişimi açılmaz. |
| Mükellef onayı | Düzenle panelindeki Demo izin ve arşiv işlemleri bölümünde işaretli örnek senaryo uygulanır. Geri alınabilir. Bu kayıt gerçek hukuki onay değildir. |
| Takvim kaynak yenileme | Yerel kurgusal kaynak kayıtları yenilenir; kişisel hatırlatmalar, notlar ve tamamlanma durumları korunur. Tekrar yenileme kayıt çoğaltmaz. |

Bunlar React belleğindeki demo canlandırmalarıdır; veritabanına izin/onay/arşiv kaydı yazılmaz. Kurum hesabı şifresi alınmaz ve gerçek GİB/SGK işi başlatılmaz.

## Son doğrulama

- Yeni üç davranış testi önce kırmızı, uygulamadan sonra yeşil görüldü.
- Proje doğrulaması: 52 dosyada **279 birim testi**; tip, mimari ve salt okunur hafıza/ajan/belge denetimleri başarılı.
- Genel demo kabul turu: **72/72**; telefon 375, tablet 768, laptop 1366 ve geniş ekran 1920 boyutlarında başarılı. Yetkili 53 içerik ekranının taraması, erişilebilirlik ve yatay taşma denetimleri dahil.
- Ayrı işlem denetimi: 46 genel sayfanın işlem akışları ve eski dört eksik kontrol dahil **50/50** başarılı.
- Toplam son tarayıcı kabul/işlem denetimi: **122 başarılı test**. Yeni arşivleme/geri alma, onay/izin geri alma, belge koruma ve kişisel not koruma akışları dört boyutta denendi. Telefon ve masaüstü izin paneli görüntüleri incelendi.
- Önceki Windows test ortamında tamamlanamayan CSV/PDF indirmeleri bu kez Docker tarayıcı ortamında başarıyla doğrulandı; önceki iptal sonuçları yeni başarılı koşuyla ayrı değerlendirilmiştir.
- Çalışan web servisinin ayarları kontrol edildi: YIGIN_KIPI=demo, EWORKS_ORTAM=demo, OZELLIK_DURUMU_GOSTER=false. Yeni davranış testleri harici kurum isteği ve uygulama API'sine yazma çağrısı olmadığını da denetler.

Son koşular: `test-results/demo-completion-final` ve `test-results/demo-completion-actions`. Ek davranış testleri: `apps/web/demo-e2e/completion.e2e.ts`; eksiklerin regresyon denetimi: `apps/web/demo-e2e/auditMissing.audit.ts`.

## Sınırlar

Bu sonuç gerçek entegrasyonun veya üretimin onaylandığı anlamına gelmez. Kullanıcı daveti/yetki düzenleme gibi genel demo işlemleri örnek kayıt formuyla canlandırılır. Kalıcı kayıt ve gerçek iş akışı geliştirmesi ayrıdır.

Yalnız 8080 demo web servisi yeniden derlendi ve başlatıldı. **8765, ilk entegrasyon, satış portalı ve hafıza dosyaları değiştirilmedi.** Testlerin tamamlandığı aşamada commit/push yapılmamıştı. Kullanıcının sonraki talebiyle paket yalnız `mert/demo-ekran-tamamlama` kişisel dalından paylaşılır; `dev` veya `main` birleşimi yapılmaz. Bağımsız kod incelemesi henüz yapılmadı.
