# Domain-Driven Design (DDD) nedir ve ne işe yarar?

> Kavramsal giriş. Bu kavramların Eworks kodundaki karşılıkları: [DDD uygulama rehberi](ddd.md). Proje kararları: [hedef-mimari/06](../hedef-mimari/06-kaynak-kod-yapisi-ddd-tdd.md).

Yazılım dünyasında projeler büyüdükçe ve karmaşıklaştıkça kodların yönetilmesi zorlaşır. Yazılımcılar işin mantığını (ne yapılması gerektiğini) yanlış anladığında ise ortaya kimsenin tam olarak işine yaramayan, hatalarla dolu sistemler çıkar. Domain-Driven Design (Alan Odaklı Tasarım), bu karmaşıklığı çözmek ve yazılımcılar ile iş sahipleri arasındaki iletişim kopukluğunu gidermek için ortaya atılmış bir felsefe ve metodolojidir.

## 1. DDD nedir?

Türkçe karşılığı Alan Odaklı Tasarım olan DDD, yazılım geliştirirken teknolojiden (hangi veri tabanını veya programlama dilini kullanacağımızdan) çok, yazılımın çözeceği gerçek dünya problemine ve iş mantığına (domain) odaklanan bir yaklaşımdır. 2003 yılında Eric Evans'ın yazdığı bir kitapla yazılım dünyasına kazandırılmıştır.

En basit benzetmeyle: Bir e-ticaret sitesi yapıyorsanız odaklanmanız gereken ilk şey veri tabanına nasıl bağlanacağınız değil; siparişin nasıl iptal edildiği, kargo süreçlerinin nasıl işlediği ve indirim kuponlarının nasıl tanımlandığı gibi tamamen e-ticaretin kendi kuralları olmalıdır.

## 2. DDD ne işe yarar? Neden kullanılır?

- **İletişim engellerini kaldırır:** Yazılımcıların teknik terimleri (tablolar, join'ler, API'ler) ile iş analistlerinin, yöneticilerin veya müşterilerin (domain expert — alan uzmanı) günlük dili arasında ortak bir köprü kurar.
- **Karmaşıklığı yönetilebilir kılar:** Büyük sistemleri, kendi içinde bağımsız çalışan mantıksal parçalara bölerek yönetmeyi kolaylaştırır.
- **Kodun ömrünü uzatır:** Teknoloji değişse bile (örneğin SQL'den NoSQL veri tabanına geçilse bile) iş kuralları değişmediği için projenin çekirdek yapısı sağlam kalır.
- **Esneklik sağlar:** Sistemin bir parçası değiştiğinde veya yeni bir kural eklendiğinde bu değişiklik tüm sistemi bozmaz, yalnız ilgili alanı etkiler.

## 3. DDD'nin temel kavramları

DDD'yi anlamak için iki ana boyuta bakmak gerekir: **stratejik** (tasarım/planlama) ve **taktiksel** (kodlama/uygulama).

### A. Stratejik kavramlar (büyük resim)

- **Domain (alan):** Yazılımın hitap ettiği ana iş koludur (örn. bankacılık, eğitim, sağlık, e-ticaret).
- **Domain expert (alan uzmanı):** Yazılımın yapılacağı işi en iyi bilen kişidir. Bir bankacılık projesinde bu kişi yazılımcı değil, bankadaki mevzuat uzmanı veya finans analistidir.
- **Ubiquitous language (ortak dil):** Projede çalışan herkesin (yazılımcı, testçi, iş analisti, müdür) üzerinde anlaştığı ortak dildir. Koddaki fonksiyon adları, veri tabanındaki alanlar ve günlük konuşmadaki kelimeler aynı kavramı aynı adla anlatmalıdır. Örneğin iş uzmanı "Sepeti Onaylamak" diyorsa kodda bunun yerine farklı bir kavram uydurulmaz; o dildeki karşılık kullanılır.
- **Bounded context (sınırlandırılmış bağlam):** Büyük bir sistemi oluşturan, sınırları net çizilmiş alt alanlardır. Bir e-ticaret sisteminde "Ürün" kelimesi kargo departmanı için ağırlık ve boyut anlamına gelirken satış departmanı için fiyat ve görsel anlamına gelir. DDD bu karışıklığı önlemek için sistemi "Kargo bağlamı" ve "Satış bağlamı" gibi net sınırlara böler.

### B. Taktiksel kavramlar (kod seviyesi)

Sınırlar çizildikten sonra kodlama yaparken kullanılan yapılar:

- **Entity (varlık):** Benzersiz bir kimliği (ID) olan nesnelerdir. Örneğin bir "Müşteri" nesnesi: müşterinin adı değişse bile ID'si değişmediği için o aynı müşteridir.
- **Value object (değer nesnesi):** Kendine ait kimliği olmayan, yalnız taşıdığı değerlerle anlam kazanan nesnelerdir. Örneğin "Adres" veya "Para birimi". İki adresin tüm sokak ve mahalle bilgileri aynıysa bu iki adres aynı kabul edilir; ayrı bir ID'ye ihtiyaç duymazlar.
- **Aggregate ve aggregate root:** Birbirine sıkı bağlı entity ve value object topluluklarıdır. Bu topluluğa dışarıdan erişimi sağlayan ve tutarlılığı koruyan lider nesneye aggregate root denir. Örneğin "Sipariş" bir aggregate root'tur, altındaki "Sipariş kalemleri" onun kontrolündedir; siparişe dokunmadan kalemleri tek başına değiştiremezsiniz.
- **Repository (depo):** Entity veya aggregate'lerin kalıcı olarak saklanması (veri tabanına yazılması veya okunması) süreçlerini yöneten yapılardır.

## 4. DDD ne zaman kullanılmalı?

DDD her proje için uygun bir ilaç değildir. "Gereksiz karmaşıklık yaratmama" (overengineering'den kaçınma) kuralı burada çok önemlidir.

- **Ne zaman kullanılmalı:** İş kurallarının yoğun ve karmaşık olduğu, sürekli değişebileceği ve yıllarca büyüyecek büyük ölçekli (enterprise) projelerde.
- **Ne zaman kullanılmamalı:** Yalnız veriyi kaydedip ekranda göstermekten ibaret (CRUD — create, read, update, delete) basit web sitelerinde, küçük yönetim panellerinde veya kısa ömürlü projelerde. Çünkü DDD ciddi bir zaman, analiz ve planlama maliyeti getirir.

Özetle Domain-Driven Design, yazılımcılara "Önce kodu ve teknolojiyi değil, işin kendisini anlayın; sisteminizi işin mantığına göre kurun" diyen bir kılavuzdur.

## Eworks'te bu kavramlar

| Kavram | Eworks'teki karşılığı |
|---|---|
| Domain | Mali müşavirlik: GİB e-Beyanname, SGK bildirimleri, mükellef portföyü |
| Alan uzmanı | Mali müşavir ve ofis personeli |
| Ortak dil | Arayüz Türkçe, kod tanımlayıcıları İngilizce; iki dil arasındaki eşleme tek sözlükte tutulur: [ai/mimari.md](../ai/mimari.md#ortak-dil-tr--kod) (Mükellef → `Taxpayer`, Beyanname → `Declaration`) |
| Bounded context | `packages/contexts/<ctx>`: `tax-filing`, `social-security`, `portfolio` … ([bağlam sayfaları](../baglamlar/README.md)) |
| Stratejik kavramların uygulanışı | [DDD uygulama rehberi §2](ddd.md#2-stratejik-tasarım) |
| Entity, value object, aggregate, repository | `src/domain`, `src/application` (repository portu), `src/infrastructure` (repository uygulaması); ayrıntı [DDD uygulama rehberi §3](ddd.md#3-taktiksel-tasarım) |

Ortak dil notu: Yukarıdaki genel anlatım, iş uzmanının terimini kodda olduğu gibi kullanmayı önerir. Bu projede tanımlayıcılar İngilizce yazılır (CLAUDE.md, "Dil ve üslup"). Ortak dil ilkesi Türkçe terim ile İngilizce tanımlayıcı arasındaki **bire bir ve sabit eşlemeyle** korunur. Yeni bir terim önce sözlüğe girer, sonra koda.
