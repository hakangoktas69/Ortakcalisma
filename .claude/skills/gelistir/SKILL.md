---
name: gelistir
description: Kod değiştiren her işte üç aşamalı akış — A) kişisel dal aç, projeyi ve işi anla; B) etki/risk/güvenlik/bağımlılık analiziyle planla, DDD + TDD ile uygula; C) tutarlılık, fonksiyonel, dört ekran görsel/erişilebilirlik/UX doğrulaması, bağımsız inceleme, kıdemli onayı ve dev'e birleştirme (dev güncellemesi, çatışma çözümü). Yeni özellik, işlem, ekran, uç, kural, migration, hata düzeltme ya da refactor. "Şu özelliği ekle", "şunu geliştir", "hatayı düzelt", "uç/ekran/tablo ekle", "/gelistir" dendiğinde ya da packages/, apps/, services/, supabase/ altında kod yazmadan önce kullan.
---

<!-- senkron:uretildi — elle düzenlemeyin; kaynak ve üretici: node tools/ajan/senkron.mjs --yaz; kaynak docs/ai/beceriler/gelistir.md -->
# Geliştir: anla → planla ve uygula → doğrula

Amaç, sistemi bozmadan değişiklik yapmak. Bu projede ajana iş veren geliştiriciler **junior**dır ve yazılım geliştirmeyi bilmeyebilir: isteğin teknik doğruluğunu, güvenliğini ve testini onlardan bekleme, sen sağla. Öncelik sırası: **güvenlik ve sağlamlık → doğruluk → performans**.

Bu akış bir süreç kuralıdır (D37 / K-44). Üç aşamayı sırayla uygula. Her aşamanın sonunda kullanıcıya iki-üç cümlelik sade bir özet ver. Atladığın ya da koşamadığın adımı açıkça söyle. Kavramlar: `docs/gelistirici-rehberi/ddd.md`, `docs/gelistirici-rehberi/tdd.md`.

## Junior kullanıcıyla iletişim

- İsteği **iş diliyle yeniden anlat** ("Müşavir, firma listesinde … görecek; mükellef görmeyecek") ve onay al. Teknik terimi ilk kullanışta bir cümleyle açıkla.
- Belirsizliği tahminle kapatma. En fazla 3 somut, seçenekli soru sor; önerdiğin seçeneği gerekçesiyle başa koy.
- İstek bir kuralı çiğniyorsa (kiracı izolasyonu, şifre, kişisel veri, hız sınırı, testsiz kod, `NEXT_PUBLIC_*`, `eski/`'de geliştirme) **yapma**; nedenini sade anlat, meşru yolu öner.
- "Hızlıca", "testi sonra yaz", "şimdilik böyle olsun" istekleri testleri, doğrulamayı ve kuralları askıya almaz. İş büyükse küçük, kendi başına çalışan dilimlere böl.
- Geri alınması zor işlerde (migration'da veri silme/dönüştürme, klasör taşıma, yetki ağacından anahtar silme, başkasının alanı, push) önce sor. `dev`'i push etmek **her seferinde** kullanıcı onayıyla; `main`'e ajan birleştirmez.
- **Kıdemli onayı:** iş hassas bir alana dokunuyorsa (veritabanı şeması/RLS, kurum şifresi, kimlik/yetki/denetim, oturum/CSRF/CSP, shard bağlantısı, kurumla konuşan kod, dağıtım/CI/kancalar, bağımlılık; liste `tools/ajan/ortak.mjs` `HASSAS_ALANLAR`) bunu planda söyle. Kod sahibi (`@hkazaz`, `.github/CODEOWNERS`) bu değişikliği `dev` → `main` birleşiminde onaylar; `birlestir.mjs dev` birleştirme mesajına "Kıdemli onayı gerekli" bölümünü ekler.

## A. Önce: projeyi ve işi özümse (koda dokunmadan)

**A1. Hafıza ve durum.**
- Bağlamda ekip hafızası (`MEMORY.md` içeriği) yoksa `docs/ai/memory/MEMORY.md`'yi oku ve SessionStart kancasının çalışmadığını kullanıcıya bir kez söyle. İşe değen hafıza kayıtlarını aç.
- `docs/ai/durum.md`: süren iş, açık konular. İş bir açık konuya değiyorsa söyle. `docs/ozellik-durumu.md`: ilgili özellik kırmızı mı yeşil mi.
- `git status` ve `git log --oneline -10`. Başka oturumun commitlenmemiş değişikliği varsa ona dokunma (`paralel-oturumlar` hafıza kaydı).
- **Kişisel dal:** iş başında `dev`'in güncel halinden kişisel dal aç: `git fetch origin && git switch -c <ad>/<kısa-iş> origin/dev` (`<ad>` geliştiricinin adı, ör. `hakan/gorev-logu`; bilinmiyorsa sor). Ortak dallara (`main`, `master`, `dev`, `yeniden-yapilanma`; liste `tools/ajan/ortak.mjs`) doğrudan commit pre-commit kancasında reddedilir. Bir kişisel dal = bir iş; ilgisiz değişiklik ayrı dala.

**A2. Yapı.**
- İşin **bağlamını** belirle: `docs/ai/mimari.md` bağlam tablosu → `docs/baglamlar/<ctx>.md` → `packages/contexts/<ctx>/src/index.ts`. İş iki bağlama da uyuyorsa ya da yeni bağlam gerektiriyorsa **dur ve sor**; yeni bağlam bir karardır (D-NN/K-NN).
- Çalışacağın dizindeki alt `CLAUDE.md`'yi oku.
- **En yakın yeşil örneği bul** (aynı türden çalışan özellik: ör. görevler için `workspace`, uç için `apps/web/src/bff/gorevler.ts`). Yeni kalıp icat etmek yerine onu izle.

**A3. İş modeli.** Koddan önce şu soruları yanıtla; yanıtı bilinmeyen varsa sor:
- Kim kullanacak (`ofis_admin`, `musavir`, `personel`, `mukellef`)? Kim **kullanamamalı**?
- Hangi yetki anahtarı? Hangi firma kapsamı? Başka ofisin kaydı 404 mü?
- Kurum hesabı kullanılıyor mu (mükellef onayı, D18)? Kuruma yazıyor mu (yalnız açık kullanıcı eylemiyle)? Kurum davranışı doğrulanmış mı?
- Kişisel veri (VKN/TCKN, ad, SGK çalışan bilgisi, sağlık) geçiyor mu? Ekranda maskeleniyor mu?
- Başarı ölçütü: kullanıcı ekranda neyi görünce "oldu" der?

**A4. Bağlamı tazele.** Okuduğun belge ya da hafıza kayıtla/kodla çelişiyorsa kodu esas al; belgeyi/hafızayı düzeltmeyi plana ekle. Hafızada adı geçen dosya, fonksiyon, bayrak hâlâ var mı, öneri yapmadan önce doğrula.

**A sonu:** isteği iş diliyle yeniden anlat, A3 yanıtlarını ve açık soruları ver.

## B. Planla ve uygula

**B1. Etki analizi.** Dokunacağın her öğe için kimin kullandığını ara (`Grep`): fonksiyonu çağıranlar, `index.ts` dışa aktarımının tüketicileri, olay aboneleri, değişen tabloyu okuyan sorgular ve görünümler, `contracts/` şemasının iki tarafı (TS + Python), etkilenen e2e testleri, yetki ağacı değişikliğinin rol şablonlarına etkisi. Migration'ın **mevcut veride** ne yapacağını yaz (boş tablo varsayma; 10 yıllık veri, D23).

**B2. Paradigma içinde kal.** Yeni kütüphane, yeni katman, yeni iletişim biçimi, bağlam sınırı aşan sorgu, kuralın istisnası = karar. Bunları kendi başına yapma; gerekçeyle sor.
- **Yeni bağımlılık** (npm/pip paketi) yalnız onayla ve şu denetimle: mevcut paket ya da Node/Python yerleşiği işi görmüyor mu; bakımı süren, yaygın paket; **sabit sürüm** (`-E`, aralık yok); lisans MIT/BSD/Apache/ISC/MPL dışındaysa (ör. GPL, AGPL, ticari) dur ve sor; güvenlik açığı denetimi (`pnpm audit --prod`, Python'da `uvx pip-audit`); ekleme Node 24 container'ında yapılır, kilit dosyası (`pnpm-lock.yaml`, `uv.lock`) aynı commit'e girer. Ad, sürüm, lisans ve denetim sonucu PR açıklamasına yazılır.
- **Migration geri alma planı:** uygulanmış migration değiştirilmez, geri dönüş yeni migration'dır (ileri düzeltme). Veri silen ya da dönüştüren değişiklik iki adımda yapılır: önce yeni yapı eklenir ve doldurulur, eski yapı ayrı bir sonraki işte kaldırılır. Planda "mevcut veride ne olur, sorun çıkarsa hangi migration düzeltir" yazılır.

**B3. Olası hataları önceden listele** ve her birini bir teste dönüştür:
- Boş/eksik/çok uzun girdi, sınır değerler, Türkçe karakter, yinelenen kayıt.
- Tarih ve dönem: ay sonu, yıl dönümü, `Europe/Istanbul`, son gün kuralları. Saat `Clock` portundan.
- Eşzamanlılık: iki kullanıcı aynı kaydı değiştirir (iyimser kilit), çift tıklama/yinelenen istek (idempotent mi?).
- Yetki: yetkisiz (403), başka ofis (404), kapsam dışı firma, mükellefin müşavir hesabını kullanma girişimi (red).
- Kurum: `wrong_password`, zaman aşımı, bakım sayfası, beklenmeyen şema → **fail-closed** (sonuç uygulanmaz, açık mesaj).
- Kısmi başarısızlık: çok adımlı yazma tek işlemde mi? Yan etki outbox'tan mı?

**B4. Önce güvenlik.** Tasarımı şu listeyle sına: girdi BFF'te sınırlı okunup doğrulanıyor (`jsonGovde`); SQL parametreli; yetki anahtarı + kapsam + RLS üçü de var; değişiklikte CSRF; HTML'e ham metin basılmıyor (`dangerouslySetInnerHTML` yok); dosya indirme denetimli ve kapsamlı; kurum şifresi yalnız Vault'ta; hata mesajı iç ayrıntı sızdırmıyor; kuruma giden istek hız sınırlayıcıdan geçiyor; yeni sır `.env.example`'a boş değerle. Bir maddeyi karşılayamıyorsan uygulamaya geçme, sor.

**B5. Planı sun.** Kısa ve sade: bağlam, özellik anahtarı, dokunulacak katmanlar, B1'de etkilenenler, B3 test listesi, B4'te dikkat edilenler, gerekiyorsa yeni sözlük terimi. Büyük ya da geri alınması zor işte onay bekle; küçük işte bildir ve devam et.

**B6. TDD ile uygula.**
- Yeni işlemse anahtarı `packages/feature-registry/src/features.ts`'e ekle (kırmızı başlar). Kullanıcı gözünden kabul testi `apps/web/e2e/<alan>.e2e.ts`, adında `@F:<anahtar>`; kurumla konuşan işlemse `live: true` ve sahte kurum sunucusu. **Hata düzeltmede** önce hatayı en düşük katmanda yeniden üreten test.
- İçten dışa döngüler; her testi yazınca **çalıştır, doğru sebepten kırmızı olduğunu gör**, kırmızının özünü raporla, sonra yalnız geçirecek kadar kod:

| Sıra | Yer | Kural |
|---|---|---|
| Domain | `packages/contexts/<ctx>/src/domain` + `test/domain` | Saf: G/Ç, `Date.now()`, rastgele, `process.env` yok. Beklenen hata `Result` ya da alan hata listesi |
| Application | `src/application` + `test/application` | Use-case `(ctx, girdi, can, d)`; bağımlılıklar port; testte `Map` tabanlı in-memory port, mock kütüphanesi yok. Her hata kodu bir testte |
| Migration + pgTAP | `supabase/migrations`, `supabase/tests` | Bağlam önekli, idempotent; PK `(org_id, id)`; indeks `org_id` ile başlar; RLS + başka ofis/kapsam dışı testi |
| Infrastructure | `src/infrastructure` + `test/infrastructure/*.int.test.ts` | Yalnız kendi şeması; `withUser`; denetim kaydı aynı işlemde |
| Public API | `src/index.ts` | Adıyla dışa aktar; başka bağlam yalnız buradan |
| BFF | `apps/web/src/app/api/...` | Tek yetki anahtarı (`apiIzni`), gövde doğrulama, `Result` → HTTP eşleme, sabit Türkçe mesaj |
| UI | `apps/web/src/app/(panel)/...`, `src/features/<ctx>` | `sayfaIzni('<anahtar>')`; iş kuralı yok |

Etiketi (`@F:` / `[F:]`) yalnız o özelliği gerçekten doğrulayan teste koy. Testi geçirmek için testi zayıflatma, `skip` bırakma, kapsam eşiğini düşürme.

**B7. Çalışma zamanı hatalarını engelle.**
- Beklenen hata `Result`; beklenmeyen hata yalnız **sınırda** (BFF ucu, işçi tüketicisi, ACL işi) yakalanır. Sınırda hatayı türüne göre ayır: bilinen durum (kapsam dışı → 404) ile altyapı hatası (veritabanı, kuyruk → 500 + log) aynı yanıta katlanmaz. Boş `catch {}` yalnız sonucu zaten anlamlı olan yerde (ör. bozuk JSON → `null`).
- TypeScript'te `as`, `!`, `any` ile tip denetimini susturma; dış veri (istek gövdesi, kurum yanıtı, kuyruk mesajı) her zaman doğrulanır.
- Dış çağrılarda zaman aşımı; yeniden deneme yalnız idempotent işte; çok adımlı yazma tek işlemde.
- Sunucu bileşeninde ve BFF'te hata ekrana `String(error)` olarak gitmez; kullanıcı sabit Türkçe mesaj ve ne yapacağını görür.

**B8. Gerekli kaydı oluştur.** İki ayrı kayıt vardır, karıştırma:
- **Denetim kaydı (`audit`)**: iş olayı, yetki değişikliği, kurum şifresi okuma, belge indirme, kuruma yazan işlem. Kalıcı, hash zincirli; use-case ile aynı işlemde yazılır.
- **Operasyon logu**: beklenmeyen hata (sınırda), iş yaşam döngüsü (başladı / bitti / başarısız, süre, sayılar), kurum çağrısının sonuç kodu, devre kesici ve hız düşüşü. Biçim: Python ACL `gunluk(olay, **ek)` (JSON satırı); işçi `console.error('✖ …')`. Web/BFF'te henüz ortak log yardımcısı yok (durum.md açık konu); gerekiyorsa dağınık `console.log` ekleme, tek bir yardımcı öner ve sor.
- Loga girer: `org_id`, `job_id`, iş türü, hata kodu/sınıfı, süre, sayı. **Girmez**: VKN/TCKN, ad soyad, e-posta, şifre, token, çerez, istek gövdesi, kurum yanıt içeriği, PDF içeriği.

**B9. Performans en son.** Ölçmeden optimize etme; ama bariz hataları yapma: listelerde sayfalama, döngü içinde sorgu (N+1) yok, büyük veri parçalı (D9), kuruma giden iş istek bütçesine göre (D25).

## C. Sonra: tutarlılığı ve davranışı doğrula

**C1. Tutarlılık analizi.**
- **Plan ↔ yapılan:** B5'teki planla `git diff`'i karşılaştır; sapma varsa nedenini söyle.
- **İş modeli ↔ kod:** A3'teki her yanıtın (kim görür, kim göremez, kapsam, onay, maskeleme) kodda ve bir testte karşılığı var mı? B3'teki her risk bir teste dönüştü mü?
- **Proje paradigması:** `pnpm arch` yeşil; adlar sözlükle uyumlu (`docs/ai/mimari.md`); arayüz/yorum Türkçe, tanımlayıcı İngilizce; en yakın yeşil örnekle aynı kalıp.
- **Diff temizliği:** hata ayıklama kodu, `console.log`, yorum satırına alınmış kod, kullanılmayan içe aktarma, `TODO`, `skip`, sır, gerçek kişi/firma verisi kalmadı.
- **Belgeler:** bağlam sayfası, ilgili `docs/ai/*.md`, karar varsa karar kaydı, durum ve hafıza aynı değişiklikte güncel.

**C2. Fonksiyonel testler.**
- `pnpm verify`: tip, mimari, birim testleri **kapsam eşiğiyle**, yetki anahtarı denetimi, hafıza, senkron, bağlantılar. Yerel Node 24 değilse `sh tools/deploy/dogrula.sh`.
- Entegrasyon, pgTAP, migration ya da işçi değiştiyse `node tools/deploy/yigin.mjs test`.
- Her yeni testin önce kırmızı görüldüğünü ve şimdi yeşil olduğunu raporla.

**C3. Görsel ve UX testleri** (arayüz değiştiyse zorunlu).
- `node tools/deploy/yigin.mjs e2e`: kabul testleri dört ekran sınıfında (375 / 768 / 1366 / 1920). Her ekran denetimi `ekranDenetle` ile yapılır (yatay taşma yok + axe-core WCAG 2.1 A/AA ciddi/kritik ihlal yok), test `hataTopla` boşken biter. İhlal testi gevşeterek değil ekranı düzelterek giderilir.
- Değişen ekranın en az 375 ve 1366 genişliğinde ekran görüntüsünü al ve **kendin incele** (geçici betik scratchpad'de; görüntü depoya girmez, demo verisiyle).
- UX kontrol listesi (otomatik taramanın yakalamadıkları): yükleniyor durumu; boş liste mesajı; hata mesajı sade Türkçe ve ne yapılacağını söylüyor; işlem süren düğme tekrar tıklanamıyor; başarı geri bildirimi görünüyor; sayfa yalnız klavyeyle (Tab, Enter, ok tuşları) kullanılabiliyor ve odak görünüyor; telefonda dokunma hedefi yeterli; tablo kendi kabında kayıyor, sayfa taşmıyor; uzun firma unvanı kırılıyor; VKN/TCKN maskeli (`maskTaxId`); tamamlanmamış işlem `<FeatureGate>`/`<FeatureBadge>` ile kırmızı.

**C4. Son güvenlik bakışı ve bağımsız inceleme.** B4 listesini bu kez `git diff` üzerinde uygula. Sonra diff'i işi yazan bakıştan bağımsız incelet: Claude'da `code-review` becerisi (hassas alan değiştiyse ayrıca `security-review`); Codex'te kullanıcıdan Codex'in `/review` komutunu bu dalda çalıştırmasını iste. Her bulguyu düzelt (düzeltme de TDD: önce test) ya da neden düzeltmediğini rapora yaz.

**C5. Rapor ve bitiş.**
- `node tools/ajan/bitir.mjs --ajan claude|codex` çıktısındaki adımları uygula.
- İş bitiminde kişisel dalda commitle (Türkçe başlık; ara commit serbest).
- Kullanıcıya sade rapor: (1) iş dilinde ne değişti; (2) hangi testler önce kırmızıydı, şimdi ne yeşil; (3) hangi doğrulama koşuldu, hangisi **koşulamadı** ve nedeni; (4) kalan risk ya da açık konu; (5) kıdemli onayı gerekip gerekmediği; (6) kullanıcının elle bakabileceği yer (ekran yolu, demo hesabı).

**C6. dev'e birleştir.** Kişisel dal commitli ve C1–C5 tamam olduğunda:

1. `node tools/ajan/birlestir.mjs guncelle`: `dev`'in güncellemelerini kişisel dala çeker (merge; rebase değil). Çatışma **kişisel dalda** çözülür, `dev`'de değil.
2. **Çatışma varsa** betik her dosyayı ve iki tarafın commitlerini listeler. Her dosya için:
   - Her iki tarafın **hedeflediği işlevi** kodda analiz et: commit mesajı, değişen testler, özellik anahtarı (`@F:`), ilgili bağlam sayfası. "Bizimki" ya da "onlarınki" toptan seçilmez.
   - İki amacı da koruyan kodu yaz; öteki tarafın testini silme ya da zayıflatma, onun testleri de yeşil kalmalı.
   - Üretilen dosyalar (AGENTS.md, MEMORY.md dizini, `.claude/skills`, CODEOWNERS, özellik durumu, kilit dosyaları) elle çözülmez, betiğin söylediği komutla yeniden üretilir.
   - **Dur ve sor:** iki tarafın iş kuralı çelişiyorsa, öteki tarafın amacı koddan anlaşılmıyorsa ya da çatışma hassas alandaysa. Kararı kullanıcı verir; gerekirse değişikliğin sahibine danışılır.
   - Çözünce `git add` + `git commit --no-edit`; vazgeçmek için `git merge --abort`.
3. **Birleşik kod yeni koddur:** çatışma olsun olmasın C2 ve C3 doğrulamalarını yeniden koş (`pnpm verify`; değişen alana göre yığın testleri ve e2e). Kırmızıysa dev'e birleştirme yok.
4. `node tools/ajan/birlestir.mjs dev --mesaj "<Türkçe başlık>\n\n<kısa rapor>"`: kişisel dalı `dev`'e `--no-ff` birleştirir. Rapor: iş dilinde ne değişti, doğrulama, koşulamayan, çözülen çatışmalar ve nasıl çözüldükleri. Hassas alan varsa betik "Kıdemli onayı gerekli (@hkazaz)" bölümünü ekler. `dev` bu arada ilerlediyse betik reddeder: 1. adıma dön.
5. **Push etme.** Kullanıcıya birleşimi ve doğrulama sonuçlarını göster, `git push origin dev` için açık onay iste (her seferinde). Kişisel dalı silmek de kullanıcı onayıyla.
6. `dev` → `main` birleşimini kod sahibi yapar; PR açıklaması `.github/pull_request_template.md`'ye göre, birleştirme mesajlarındaki raporlardan derlenir.
