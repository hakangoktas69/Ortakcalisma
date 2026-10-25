# Test-Driven Development (TDD) nedir ve ne işe yarar?

> Kavramsal giriş. Bu döngünün Eworks'te nasıl uygulandığı: [TDD uygulama rehberi](tdd.md). Proje kararları: [hedef-mimari/06 §7–§8](../hedef-mimari/06-kaynak-kod-yapisi-ddd-tdd.md#7-tdd-süreci-d22).

Yazılım geliştirirken en sık yaşanan sorunlardan biri, yeni bir özellik eklerken veya mevcut bir kodu değiştirirken sistemin başka bir yerini farkında olmadan bozmaktır. Genellikle yazılımcılar önce kodu yazar, ardından çalışıp çalışmadığını elle test eder. TDD (Test Güdümlü Geliştirme) ise bu alışkanlığı tersine çeviren, koda rehberlik eden disiplinli bir yaklaşımdır.

## 1. TDD nedir?

Türkçe karşılığı Test Güdümlü Geliştirme olan TDD, yazılım geliştirme sürecinde **"önce test, sonra kod"** ilkesini benimseyen bir metodolojidir. Yani henüz ortada çalışacak tek satır fonksiyon kodu bile yokken, o fonksiyonun nasıl çalışması gerektiğini anlatan test senaryosu yazılır.

TDD temelde üç adımdan oluşan ve sürekli tekrarlanan bir döngüye dayanır. Bu döngüye **"Red – Green – Refactor"** (kırmızı – yeşil – düzenleme) döngüsü denir.

## 2. TDD döngüsü nasıl çalışır? (Red – Green – Refactor)

1. **Kırmızı (red):** Yapmak istediğiniz işlev için küçük bir test yazarsınız. Ortada henüz kod olmadığı için test doğal olarak başarısız olur ve test ekranında kırmızı yanar.
2. **Yeşil (green):** Testin başarılı olmasını (yeşil yanmasını) sağlayacak kadar, olabilecek en basit ve en az kodu yazarsınız. Amaç kodu mükemmel yapmak değil, yalnız testten geçmesini sağlamaktır.
3. **Düzenleme (refactor):** Test yeşile döndükten sonra yazılan kod incelenir. Kod kalitesini artırmak, okunabilirliği düzeltmek ve tekrarları önlemek için kod temizlenir. Bu temizlik sırasında testlerin hâlâ yeşil kaldığı denetlenir.

## 3. TDD ne işe yarar? Avantajları nelerdir?

- **Hata payını en aza indirir:** Kod daha yazılırken test edildiği için canlı ortama (production) çıkacak hatalar (bug) büyük oranda engellenir.
- **Korkusuzca değişiklik yapmayı sağlar:** Aylar önce yazılmış bir kodu değiştirmeniz veya iyileştirmeniz gerektiğinde arkanızda çalışan yüzlerce test olduğunu bilirsiniz. Bir şey bozulursa testler anında kırmızı yanarak sizi uyarır.
- **Kodun tasarımını iyileştirir:** Önce testi yazmak, yazılımcıyı "Bu kodu dışarıdan nasıl çağıracağım, girdileri ve çıktıları ne olacak?" diye düşünmeye zorlar. Bu da daha temiz, modüler ve esnek bir yapı (mimari) oluşturur.
- **Canlı dokümantasyon oluşturur:** Yazılan testler, o kodun ne işe yaradığını ve hangi durumda ne sonuç ürettiğini gösteren en güncel ve en doğru kullanım kılavuzudur.

## 4. Basit bir örnekle TDD

Bir hesap makinesi uygulaması yaptığınızı ve iki sayıyı toplayan bir fonksiyon yazacağınızı düşünelim:

- **Geleneksel yöntem:** `Topla(a, b)` fonksiyonunu yazar, içini doldurursunuz. Sonra programı çalıştırıp `Topla(2, 3)` yazar ve ekranda 5 görecek misiniz diye bakarsınız.
- **TDD yöntemi:** Önce bir test dosyası açar ve "`Topla` fonksiyonuna 2 ve 3 gönderirsem sonuç 5 olmalıdır" dersiniz. Testi çalıştırırsınız; sistemde henüz `Topla` olmadığı için hata verir (kırmızı). Ardından yalnız `return a + b;` yapan fonksiyonu yazarsınız, test geçer (yeşil). Son olarak gerekirse fonksiyonun adını veya yapısını düzenlersiniz (refactor).

## 5. TDD ne zaman kullanılmalı?

TDD harika bir pratik olsa da her yazılım sürecinde esnek değerlendirilmelidir.

- **Ne zaman kullanılmalı:** İş kurallarının ve mantıksal hesaplamaların yoğun olduğu yerlerde; finans, ödeme sistemleri, veri işleme modülleri gibi hataya tahammülü olmayan kritik projelerde mutlaka kullanılmalıdır.
- **Ne zaman zorlayıcı olabilir:** Arayüz tasarımı (UI/UX) ağırlıklı işlerde, sürekli değişen ve netleşmemiş prototip (PoC) çalışmalarında veya test yazmanın teknik olarak çok zor olduğu dış bağımlılıklı sistemlerde süreci yavaşlatabilir.

Özetle Test-Driven Development, kod kalitesinin etrafına bir güvenlik ağı örmektir. İlk başta zaman kaybettiriyor gibi görünse de uzun vadede hata ayıklama (debugging) süresini büyük ölçüde azalttığı için projeyi çok daha hızlı ve güvenli büyütür.

## Eworks'te TDD

Eworks, yukarıdaki listedeki "mutlaka kullanılmalı" grubundadır: vergi ve SGK verisi, kurum şifreleri ve kiracı izolasyonu hataya tahammül etmez. Bu yüzden TDD bu projede **isteğe bağlı değildir** (D22, [kurallar](../ai/kurallar.md) — testsiz kod yok, kapsam eşiği düşürülmez).

| Genel anlatım | Eworks'teki karşılığı |
|---|---|
| Kırmızı → yeşil | Her işlem `feature-registry`'ye girer ve **kırmızı** başlar; anahtara bağlı kabul testi geçince CI **yeşil** hesaplar. Durum arayüzde de görünür ([özellik durumu](../ozellik-durumu.md)) |
| Küçük test | Önce kullanıcı gözünden etiketli kabul testi (`@F:<anahtar>`), sonra içten dışa domain → application → altyapı testleri ([TDD uygulama rehberi §4.2](tdd.md#42-özellik-düzeyi-kayıttan-yeşile)) |
| "UI ağırlıklı işte zorlayıcı" | Arayüz dört ekran sınıfında Playwright kabul testleriyle doğrulanır |
| "Dış bağımlılıklı sistemde zor" | Kurum (GİB/SGK) için sahte kurum sunucusu kullanılır; canlı davranış ayrıca canlı doğrulama kaydıyla kanıtlanır (D33, [canli-dogrulama.md](canli-dogrulama.md)) |
| Hata düzeltme | Önce hatayı yeniden üreten test, sonra düzeltme |
