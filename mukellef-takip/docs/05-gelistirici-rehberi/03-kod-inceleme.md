# 5.3 Kod inceleme kontrol listesi

> İnceleyen ve yazan için ortak liste. Otomatik kapılar (`npm run verify`) neyi yakalıyorsa burada tekrar edilmez; bu liste **makinenin yakalayamadıklarına** odaklanır.

## Otomatik olarak yakalananlar (inceleme öncesi yeşil olmalı)

lint (oxlint + ESLint) · mimari sınırlar (`arch:check`) · tip kontrolü (api + `next typegen`) · birim testleri ve kapsam eşikleri · e2e (gerçek PostgreSQL + RLS + Redis) · arayüz testleri (4 ekran, taşma, konsol hatası) · gitleaks · Trivy. Ayrıntı: [testing.md](../ai/testing.md).

## 1. Model ve sınırlar

- [ ] Değişiklik doğru bağlamda mı? Terimler [ortak dil](../01-stratejik-tasarim/02-ortak-dil.md)'le uyumlu mu?
- [ ] İş kuralı `domain/`'de, saf ve testli mi? Controller'da veya Prisma sorgusunda kural yok mu?
- [ ] Başka bağlamın tablosu doğrudan okunmuyor mu (facade kullanılmış mı)? Okunuyorsa [taktik borç](../03-taktiksel-tasarim/06-taktik-borc.md)'a yazıldı mı?
- [ ] `index.ts`'e eklenen şey gerçekten public API mi (ayrıştırıcı/DTO/Prisma tipi sızmıyor)?
- [ ] Yeni olay: ad geçmiş zaman, yük kendine yeterli, **kişisel veri minimum**, verinin transaction'ında yazılıyor, abone idempotent.

## 2. Kiracılık ve yetki

- [ ] Yeni uç `AuthGuard` altında; yönetici işi `AdminGuard`'lı. Guard'sız uç varsa gerekçesi yorumda ve testte.
- [ ] Servis büroyu filtreliyor; `id` ile bulunan kayıt büroya ait değilse **404** (403 değil — varlığı sızdırma).
- [ ] `runAsSystem` kullanımı gerçekten gerekli mi, kapsamı en dar mı, hemen ardından `runAsTenant`'a geçiliyor mu?
- [ ] Yeni büro tablosunda RLS politikası + çapraz büro e2e testi var mı?
- [ ] Toplu işlemler (`updateMany`, `deleteMany`) büro koşulunu içeriyor mu?

## 3. Kişisel veri ve KVKK

- [ ] Yeni kişisel veri alanı gerçekten gerekli mi? Şifreli + blind index mi?
- [ ] Log satırları, hata mesajları, istisna metinleri, denetim `detail`'i, olay yükü, `externalBody`, LLM'e giden metin: **TCKN, ad soyad, sağlık verisi yok**.
- [ ] Yanıtta tam TCKN dönmüyor (e2e'de `expectNoFullTckn`).
- [ ] Kişisel veriye erişen/değiştiren eylem için denetim kaydı var.
- [ ] Yurt dışına yeni veri akışı yoksa ✔; varsa onay mekanizması ve belge güncellemesi.

## 4. Tutarlılık ve hata durumları

- [ ] Birlikte değişmesi gereken satırlar tek `$transaction`'da mı?
- [ ] Eşzamanlı iki istek (çift tıklama, geri dönüş + yenile) aynı sonucu iki kez üretebilir mi? Koşullu güncelleme / benzersiz indeks var mı?
- [ ] İçe aktarma idempotent mi (aynı sayfa iki kez)? `dryRun` önizlemesi sonucu doğru gösteriyor mu?
- [ ] Dış servis hatası kullanıcıya anlaşılır Türkçe mesaj, log'a ayrıntı (PII'sız) olarak mı dönüyor?
- [ ] Prisma sorgusu bağlam (`runAsTenant`) içinde başlatılıyor mu (tembel sorgu tuzağı)?

## 5. Güvenlik genel

- [ ] Kullanıcı girdisi DTO ile sınırlı (uzunluk, biçim, dizi boyutu); dosya yüklemede boyut ve tür sınırı.
- [ ] Ham SQL yalnız `$queryRaw` şablon etiketiyle (parametreli); `$queryRawUnsafe` yok.
- [ ] CSV/Excel çıktısı formül enjeksiyonuna karşı `csv.ts` ile.
- [ ] Yeni yapılandırma `config.ts` zod şemasında; üretimde güvensiz değer reddediliyor.
- [ ] Yeni bağımlılık: gerçekten gerekli mi, bakımı var mı, lisansı uygun mu, [tech-stack](../ai/tech-stack.md)'te yasaklı değil mi? Sürüm sabit mi?

## 6. Test kalitesi

- [ ] Davranışı test ediyor, uygulamayı değil (iç fonksiyonu taklit etmek yerine uçtan sonuca bakıyor).
- [ ] Mutlu yol + doğrulama + yetki + çapraz büro + sınır durumu.
- [ ] Tarih bağımlı testler sabit `now` kullanıyor.
- [ ] Atlanan (`skip`) veya gevşetilen test/eşik yok; varsa gerekçeli.

## 7. Web

- [ ] 4 ekran boyutunda taşma yok (`PANEL_ROUTES`'ta mı?); tablolar `table-scroll`.
- [ ] Metinler Türkçe, hata mesajları kullanıcı dostu; boş/yükleniyor/hata durumları var.
- [ ] Belirteç veya kişisel veri `localStorage`'a yeni eklenmiyor.

## 8. Belgeler

- [ ] Kural/uç/olay/sınır değiştiyse ilgili [bağlam sayfası](../02-baglamlar/README.md).
- [ ] Mimari karar → ADR; güvenlik kuralı → `docs/ai/security-kvkk.md`; yeni terim → ortak dil.
- [ ] Kullanıcıya görünen değişiklik → `changelog.ts` (gerekirse `faq.ts`); uç → `README.md`.
- [ ] Yol haritası maddesi kapandıysa `docs/ai/roadmap.md`.

## İnceleme tonu

Bulguyu "**ne olur**" ile yaz (ör. "B bürosu bu uçla A'nın faturasını silebilir: `deleteMany` büro koşulsuz"). Zorunlu olanı (güvenlik, veri bütünlüğü) tercihten (isim, stil) ayır: `zorunlu:` / `öneri:`.
