---
name: eworks-acik-konular
description: Eworks açık konuları (2026-10-26) — 60/dk hız ile 500 ofis ölçeği, shard donanımı, bağlama atanmamış modüller, GitHub dal koruması, Codex beceri desteği, canlı GİB doğrulaması, bağlamlar arası okuma birleşimleri, yönetim ekranları, ACL kapsam eşiği zorlanmıyor, TDD rehberindeki keşif kodu ifadesi onay bekliyor, operasyon logu yok ve hatalar sessizce yutuluyor, ekranda VKN maskeleme uygulanmıyor, Mert'in pilot işi ile D28 çelişkisi, dal adı uyumu, küçük UX (TabloKap odak), servis yolunun gözlenmemiş ağ ayrıntıları, üretim yedeği ve yayın hattı yok, satış lisansı girişi engellemiyor, geçici parola portalda zorunlu değişmiyor, satış portalının üretimde yayımı, satış log yardımcısı, satıştan ofis açmada yarım kalma
metadata:
  type: project
---

2026-10-26 itibarıyla Eworks hedef mimarisinde açık konular (aynı liste `docs/ai/durum.md`'de):

1. **Hız ve ölçek tutarlılığı:** 500 ofis × 1.505 ≈ 752.500 kurum hesabı var. Gece penceresi 20:00–09:00. Hepsini bir gecede taramak için web serviste ≈ 3.216 istek/dk gerekir. 60 istek/dk toplam başlangıç hızıyla tam tarama ≈ 54 gece sürer, robotla ≈ 536 gece (`docs/hedef-mimari/03-kaynak-verimliligi-ve-kapasite.md` §1a). Netleşmesi gerekenler:
   - "60 istek/dk ile başla" ve "hesap başına 60 istek/dk" ifadelerinin kapsamı (toplam mı, kurum mu, servis mi robot mu, hesap mı?);
   - web servis analizinden çıkacak kurum limitleri.
2. **Shard başlangıç donanımı:** Öneri: kontrol düzlemi + 2 fiziksel shard sunucusu, 16 mantıksal shard (`docs/hedef-mimari/07-veri-saklama-ve-sharding.md` §2.3).
3. **Bağlama atanmamış portal modülleri:** e-Tebligat, e-Defter, Faturalar, Dilekçeler, Ödeme, Raporlar, Destek `feature-registry`'de `context: null` (`docs/baglamlar/README.md`). Yeni bağlam mı, mevcut bağlam mı kararı bekliyor.
4. **GitHub dal koruması yok (2026-10-26):** kod sahibi `@hkazaz` (CODEOWNERS `HASSAS_ALANLAR`'dan üretilir, D37) ama `main`'de PR + CI + kod sahibi onayı zorunluluğu GitHub'da açılmadı; `dev`'de doğrudan push engeli yok; yerel pre-commit kancası `--no-verify` ile aşılabilir.
5. **Codex proje içi beceri desteği** doğrulanmadı; yedek yol `AGENTS.md` "Beceriler" bloğu (09 §7.5).
6. **Canlı GİB doğrulaması (2026-10-25):** eski portalın portu bitti; `firmalar.gib_sozlesmeler.sync`, `beyanname.senkron.start`, `sgk.ebildirge.sync` yalnız sahte GİB'e karşı sınandı. Canlı koşu Hakan'ın hesabıyla (`docs/gelistirici-rehberi/canli-dogrulama.md`); canlı güvenlik kodunda OCR başarısı bilinmiyor.
7. **Bağlamlar arası okuma birleşimleri:** tax-filing/social-security/workspace sorguları unvan için `portfolio.firms` ile birleşiyor (kural 5'ten sapma); okuma modeline taşınacak.
8. **Yönetim ekranları yok:** personel ataması, kişiye özel izin, davet, mükellef kullanıcıları; şimdilik `hesap-ac` komutu.
9. **ACL kapsam eşiği zorlanmıyor (2026-10-25):** kurallarda "ACL ayrıştırıcıları %90" yazılı, ama `services/integration`'da pytest kapsam ölçümü (`pytest-cov`, `--cov-fail-under`) yok; TS tarafı (domain + application + kernel %90/%80) `pnpm verify` ve CI'da zorlanıyor. Eklemek imaj bağımlılığı ve CI adımı ister.
10. **Keşif kodu ifadesi onay bekliyor (2026-10-25):** `docs/gelistirici-rehberi/tdd.md` §5.3'teki "deneme kodu olduğu gibi birleştirilmez; öğrenilen davranış önce teste dönüşür" ifadesi yazılı bir kural değil, "testsiz kod yok" kuralından çıkarıldı. Ekip onaylarsa kurallara işlenir, onaylamazsa rehberden çıkarılır.
11. **Operasyon logu yok, hatalar sessizce yutuluyor (2026-10-26):** `apps/web`'de ortak log yardımcısı yok. Örnekler: `api/gorevler` ve `api/notlar` her hatayı (veritabanı kesintisi dahil) "Firma bulunamadı" 404'üne katlıyor ve loglamıyor; `apps/worker/src/uygulayici.ts` ham kurum sonucunu S3'ten silemezse yutuyor (ham sonuç depoda kalabilir, KVKK); `packages/platform/src/depo.ts` kova oluşturma hatasını yutuyor. Kural `docs/ai/kurallar.md` "Hata ve log"da; tek log yardımcısı (kişisel veri süzgeçli) ve bu üç yerin düzeltilmesi bekliyor.
12. **Ekranda VKN/TCKN maskeleme uygulanmıyor (2026-10-26):** kural 8 "ekranda maskelenir (`maskTaxId`)" diyor, `maskTaxId` (`packages/kernel`) hiçbir ekranda çağrılmıyor; firma listesi/kartı tam numarayı gösteriyor. Müşavirin kendi portföyünde tam numara gerekebilir; hangi ekran ve rolde maskeleneceği kararı bekliyor.
13. **Eworks 2'nin yeni yapıya taşınması (2026-10-26):** Mert'in 23.10 işi `eski/mert/eworks/<kısa-sha>-<commit adı>/` altında arşivde. Kurum erişimi (aynı oturum HTTP taşıması, sınıflı hatalar) D38 ile taşındı. Sırada: oturum bütçesi, kaldığı yerden devam, hatalı belgeyi yeniden deneme (`sync` bağlamı); ardından bağlantı testi ve e-Defter YB/KB/Y matrisi (canlı kaynak yok, kırmızı kalır). Erişim yolu bugün kurum başına ortam parametresi; ofis/entegrasyon bazlı `integrations` kaydı ve otomatik yedek yok. Eworks 2 23.10'da canlıda çalıştı ve sınandı (Mert, VALIDATION.md); yeni yapıdaki uyarlama için canlı kayıt bekliyor (D33). Mert'e bildirim bekliyor.
14. **Dal adı uyumu (2026-10-26):** D37 `<ad>/<kısa-iş>` diyor; Mert'in belgeleri `feature/…` diyor; uzakta ikisi de var. Kanca adı denetlemez. Tek kural seçilip duyurulmalı.
15. **Küçük UX (2026-10-26):** `TabloKap` her ekranda odaklanabilir; geniş ekranda fazladan sekme durağı.
16. **Servis yolunun gözlenmemiş ağ ayrıntıları (2026-10-26):** Eworks 2 alan adlarını ve uçları veriyor; `cmd` değerleri, sonraki sayfa isteğinin biçimi, tarih biçimi ve geçersiz oturum yanıtı arşivde yok. Sahte e-Beyanname bunlar için kendi seçimini kullanır (`BEYANNAMELISTESI`, `BEYANNAMELISTESI_SAYFA`, yyyymmdd, 401); servis doğrulaması bunlara bağlı değildir (altı tarih biçimi, `cmd` yalnız dolu). Canlı koşuda gözlenip sahte sunucuya işlenmeli; canlı sayfalama tarih alanlarını yeniden gönderirse izinli alan listesi genişletilmeli. Varsayılanın `servis` olması (D38) canlı kayıt öncesi üretimde de bu yolu açar.
17. **Üretim yedeği ve yayın hattı yok (2026-10-26):** VPS'te yalnız elle yedek (`pg_dumpall`, S3 arşivi, `.env`); otomatik şifreli yedek ve geri yükleme sınaması (Vault anahtarı dahil) yok
18. **Lisans girişi engellemiyor (D40):** satış lisansı yalnız kayıt; engelleme identity-access değişikliği + süresi dolunca ekran kararı ister; lisans uzatma/ödeme bekliyor.
19. **Geçici parola portalda zorunlu değişmiyor:** satışçı müşavirin geçici parolasını bilir; portal girişine zorunlu değiştirme gerekir (hassas alan).
20. **Satış portalı üretimde yalnız 127.0.0.1 (SSH tüneli):** uzaktan çalışma için alan adı + TLS + IP kısıtı/VPN kararı.
21. **Satış portalının log yardımcısı yerel** (`apps/sales/src/bff/gunluk.ts`); ortak yardımcı (açık konu 11) gelince taşınır.
22. **Satıştan ofis açma tek işlem değil:** GoTrue kullanıcısı açıldıktan sonra kesinti olursa e-posta kalır, yeniden deneme `eposta_kullanimda` verir; telafi GoTrue silme ucu + identity-access değişikliği ister, şimdilik elle kurtarma.. İmajlar sunucuda kaynaktan derleniyor; CI imaj yayını, sürüm etiketi, kesintisiz güncelleme, gözlem/uyarı yok.

Süren iş: GİB/SGK web servis envanteri ve kurum erişim bilgileri Hakan tarafından analiz ediliyor (2026-10-24). Sonuç gelince 02 §1a'daki `integrations` tablosu ve 03 §1a hesapları güncellenir.

Kapananlar: D23–D30 (K-31…K-37) 2026-10-24; Mükellef Takip'in `eski/` sonrası durumu → **arşiv** (D32/K-39); depo taşıma tarihi ve ekip duyurusu → taşıma 2026-10-24'te yapıldı, duyuru önceden yapıldı ([[eworks-yeniden-yapilanma]]).

**Why:** Bu konular kapanmadan kapasite planı, bağlam sınırları ve sahiplik kesinleşemez; kullanıcı açık konuların hafızada durmasını istedi (2026-10-24).
**How to apply:** Eworks işine başlarken bu listeye bak. Konu kapanınca: `D-NN` + `K-NN` + ilgili `docs/hedef-mimari` belgesi + `docs/ai/durum.md` güncellenir, madde buradan silinir ([[eworks-calisma-bicimi]]). Kararların özeti: [[eworks-hedef-mimari]].
