# 1. Yönetici özeti (CTO)

> Önce: [Genel bakış](00-genel-bakis.md) · Ayrıntı: [Eksikler](04-eksikler-ve-riskler/01-mimari-yapisal-eksikler.md), [Güvenlik riskleri](04-eksikler-ve-riskler/02-guvenlik-riskleri.md), [Plan](04-eksikler-ve-riskler/03-iyilestirme-plani.md)

## Tek cümle

Eworks, **tek müşavir, tek bilgisayar** için çalışan, güvenlik bilinciyle yazılmış ama ürünleşmeye hazır olmayan bir **yerel pilot**tur; değeri GİB ekranlarını okuyan robot bilgisindedir, portal kısmı Mükellef Takip ile örtüşür.

## Olgunluk

| Alan | Değerlendirme |
|---|---|
| İşlevsel kapsam | Sözleşme listesi canlıda doğrulandı (274 kayıt). Beyanname/PDF/SGK okuma kodlu, sentetik testli; canlı tam tarama yok. e-Defter, e-Tebligat tamamlanmadı. |
| Kod büyüklüğü | Robot ~6.000 satır Python (testler dahil, 32 modül + 28 test). Portal tek dosya 244 KB HTML/JS. |
| Kod kalitesi | Girdi doğrulama, fail-closed hata yönetimi, log maskeleme iyi. Ön yüz modülsüz, lint/tip denetimi yok. |
| Test | 28 birim test dosyası; `VALIDATION.md`'ye göre seçili 48 test geçiyor, tamamı değil. CI yok, SQL/RLS testi yok. |
| İşletim | Kurulum elle (SQL Editor'e yapıştırma), Windows'a bağlı, sürümleme/yayın süreci yok, izleme yok. |
| Ölçeklenme | Tek kullanıcı, tek iş, görünür Chrome, bellek içi iş listesi. Sunucuya taşınamaz (CAPTCHA + görünür tarayıcı). |

## Karar gerektiren 5 konu

1. **Otomatik GİB girişi (G-01, Kritik/uyum).** 21.10 sürümü Vault'taki şifreyi doldurup CAPTCHA'yı OCR ile çözüyor ve "Giriş Yap"a kendisi basıyor. Belgeler (`Kullanim.md`, `robot-config.json`) hâlâ "CAPTCHA'yı kullanıcı tamamlar" diyor. GİB kullanım koşulları ve Mükellef Takip'in "otomatik GİB girişi yok" kuralı ile çelişir. **Karar:** kapat (önerilen) veya hukuki görüşle bilinçli kabul et.
2. **KVKK — yerel diskte kalan kişisel veri (G-04) ve yurt dışı aktarım (G-05).** VKN/TCKN listeleri, SGK PDF'leri iş klasörlerinde süresiz düz metin kalıyor; Supabase bölgesi yurt dışıysa TCKN/GİB şifresi yurt dışına aktarılıyor. **Karar:** saklama süresi + bölge/aktarım dayanağı.
3. **Ürün stratejisi.** Eworks portalını ayrı ürün olarak mı büyütmek, yoksa robotu Mükellef Takip'e veri kaynağı yapıp portalı emekliye mi ayırmak? Teknik analiz ikincisini öneriyor: tek JSONB veri modeli, tek kullanıcılı yapı ve 244 KB'lık tek dosya, çok kiracılı bir ürüne evrilmeye uygun değil.
4. **Kaynak gerçeği (M-15).** Depodaki kod "paylaşım kopyası". Çalışan sürüm Mert'in yerelinde. Tek doğruluk kaynağı (depo) ve sürüm etiketi kararı.
5. **GİB arayüz bağımlılığı (M-09).** Robot GİB'in menü metinlerine/DOM'una bağlı; GİB değişince sessizce değil ama kesin olarak durur. Bakım için kişi/kapasite ayrılması veya resmi kanal (GİB entegratör/API) araştırılması.

## Güçlü yanlar (korunmalı)

- Service-role anahtarı yalnızca sunucu tarafında; tarayıcı GİB şifresini geri okuyamıyor.
- Robot veritabanına yazmıyor; kayıt kullanıcı oturumuyla, sürümlü ve idempotent (`eworks_commit`).
- RLS gevşetilirse portal açılmayı reddediyor (`eworks_security_check`).
- Log ve tanılama dosyalarında token/JWT/TCKN maskeleme.
- PDF'ler içerik özetiyle (SHA-256) adreslenip geri okunarak doğrulanıyor.

## Risk özeti

| Önem | Adet | Örnek |
|---|---|---|
| Kritik | 2 | Otomatik GİB girişi; çalınan JWT ile GİB şifresinin düz metin alınabilmesi |
| Yüksek | 4 | Yerel diskte kalan kişisel veri; yurt dışı aktarım; Vault okuma denetim kaydı yok; CSP yok + elle kaçışlama |
| Orta | 6 | Yerel köprü uç noktaları; çalışma anında kod yeniden yükleme; sabitlenmemiş bağımlılıklar; yetim Vault sırları … |
| Düşük | 4 | Hata mesajı sızıntısı; değiştirilebilir loglar … |

Ayrıntı ve öneriler: [02-guvenlik-riskleri.md](04-eksikler-ve-riskler/02-guvenlik-riskleri.md).

## Önerilen yatırım sırası

1. **Hemen (1 hafta):** G-01 kapat/karar, iş klasörü temizliği, belgeleri koda eşitle, Supabase bölgesini netleştir.
2. **Kısa vade (2–4 hafta):** robot için ayrı kısa ömürlü kimlik bilgisi + Vault okuma denetimi, CSP, migration aracı, CI'da tüm testler.
3. **Orta vade:** robotu Mükellef Takip'e veri kaynağı olarak bağla (`POST /api/import/...`, `ApiToken gib:import`), Eworks portalını dondur.

Ayrıntı: [03-iyilestirme-plani.md](04-eksikler-ve-riskler/03-iyilestirme-plani.md).
