// Sıkça sorulan sorular. Cevaplar uygulamanın gerçek davranışını anlatır; bir özellik değiştiğinde burası da güncellenmeli.
// Vergi / SGK mevzuatı soruları için kullanıcı "Uzmana Sor"a yönlendirilir; burada mevzuat yorumu yapılmaz.

export interface FaqItem {
  id: string;
  q: string;
  /** Paragraflar; "- " ile başlayan satırlar madde olarak gösterilir */
  a: string[];
  /** Cevabın sonunda gösterilen ilgili sayfa */
  link?: { href: string; label: string };
}

export interface FaqSection {
  id: string;
  title: string;
  items: FaqItem[];
}

export const FAQ: FaqSection[] = [
  {
    id: "baslarken",
    title: "Başlarken",
    items: [
      {
        id: "mukellef-ekleme",
        q: "Mükelleflerimi nasıl eklerim?",
        a: [
          "Mükellefler sayfasında tek tek \"Yeni firma\" ile ekleyebilirsiniz.",
          "Çok sayıda mükellef için yönetici \"Excel'den aktar\" ile toplu aktarım yapabilir. Önce örnek şablonu indirin; zorunlu sütunlar Unvan / Ad Soyad ve VKN / TCKN. Dosya önce önizlenir, onaylamadan hiçbir şey kaydedilmez.",
          "Portalda zaten kayıtlı bir VKN tekrar gelirse yeni kayıt açılmaz, mevcut kayıt güncellenir. Boş bırakılan hücreler mevcut bilgiyi silmez.",
        ],
        link: { href: "/firmalar", label: "Mükellefler" },
      },
      {
        id: "is-kutusu",
        q: "İş kutusu nedir?",
        a: [
          "Açılış sayfası. Beyanname, e-tebligat, e-rapor, e-Defter beratı, bordro ve lisanstan gelen açık işleri tek listede, en acil olan üstte gösterir.",
          "Bir işe tıklayınca sağda ayrıntısı ve doğrudan işlem düğmesi açılır (ör. \"Verildi olarak işaretle\", \"İncelendi\"). İş ilgili ekranda tamamlandığında listeden kendiliğinden düşer.",
          "Bir işi şimdi yapamayacaksanız \"Sonra hatırlat\" ile yarına, 3 gün sonrasına veya gelecek haftaya erteleyebilirsiniz; erteleme bütün büro için geçerlidir. Klavyede ↑ ↓ tuşlarıyla işler arasında gezebilirsiniz.",
          "Sayılar ve grafiklerle özet görmek için sol menüdeki Genel bakış sayfasını açın.",
        ],
        link: { href: "/", label: "İş kutusu" },
      },
      {
        id: "komut-paleti",
        q: "Ctrl+K ne işe yarıyor?",
        a: [
          "Ctrl+K (Mac'te Cmd+K) ya da yazı alanı dışındayken \"/\" tuşu, her sayfadan açılan arama kutusunu getirir.",
          "Buradan mükellefi unvanıyla veya VKN'siyle bulabilir, bir sayfaya gidebilir ya da \"Fatura yükle\", \"Koyu temaya geç\" gibi işlemleri başlatabilirsiniz. Ok tuşlarıyla gezinip Enter ile açarsınız.",
        ],
      },
      {
        id: "tema",
        q: "Koyu temaya nasıl geçerim?",
        a: ["Sol alttaki yuvarlak hesap simgenize tıklayın; açılan menüden Açık, Sistem (bilgisayarınızın ayarını izler) veya Koyu seçin. Varsayılan açık temadır; seçiminiz bu tarayıcıda hatırlanır."],
      },
      {
        id: "demo-modu",
        q: "Ekranda \"Demo modu\" yazıyor. Bu ne demek?",
        a: [
          "O bölüm henüz gerçek kuruma bağlanmadı ve örnek verilerle çalışıyor. Örneğin SGK demo modundaysa e-raporlar SGK'dan değil, örnek veriden gelir.",
          "Gerçek bağlantı sunucu ayarlarından açılır; bu ayarı portalı kuran teknik yönetici yapar.",
        ],
      },
    ],
  },
  {
    id: "gib-sgk",
    title: "GİB ve SGK verileri",
    items: [
      {
        id: "gib-sifre",
        q: "Portal GİB şifremi istiyor mu?",
        a: [
          "Hayır. Beyanname, e-tebligat ve e-Bildirge listeleri, sizin kendi bilgilerinizle açtığınız GİB veya SGK sayfasından tarayıcı eklentisiyle aktarılır.",
          "Eklenti şifrenizi görmez ve GİB'e kendisi istek atmaz. Sadece açık sayfadaki tabloyu okur, önce önizleme gösterir, siz \"Aktar\"a basınca kaydeder.",
        ],
      },
      {
        id: "eklenti-kurulum",
        q: "Tarayıcı eklentisini nasıl kurarım?",
        a: [
          "Beyannameler veya e-Tebligat sayfasında \"GİB'den aktar\" düğmesine basın. Açılan pencerede kurulum adımları ve eklenti anahtarı oluşturma yeri var.",
          "Eklenti anahtarı portal şifreniz değildir: sadece aktarım yapabilir ve aynı pencereden istediğiniz an iptal edilebilir.",
        ],
        link: { href: "/beyanname", label: "Beyannameler" },
      },
      {
        id: "ebildirge",
        q: "SGK e-Bildirge belgelerini nasıl aktarırım?",
        a: [
          "SGK e-Bildirge'de onaylı bildirge listesini kendi bilgilerinizle açın ve eklentide \"Bu sayfayı oku\"ya basın.",
          "Belgelerin hangi işyerine ait olduğu sayfadaki sicil numarasından bulunur. Bulunamazsa eklenti sizden işyeri sicil numarasını ister.",
        ],
        link: { href: "/sgk", label: "SGK" },
      },
      {
        id: "vizite-sifre",
        q: "SGK Vizite için neden işyeri şifresi isteniyor?",
        a: [
          "e-raporları SGK'nın resmi Vizite servisinden çekmek ve onaylamak için bu servis işyeri kullanıcı bilgilerini ister.",
          "Girdiğiniz şifre önce SGK'da denenir, doğruysa şifrelenmiş olarak saklanır ve hiçbir ekranda geri gösterilmez. Her kullanım kayıt altına alınır. Bilgileri SGK sayfasındaki İşyerleri sekmesinden istediğiniz an silebilirsiniz.",
        ],
      },
      {
        id: "teblig-tarihi",
        q: "Tebligatı açmadım. Süre yine de başlar mı?",
        a: [
          "Evet. e-Tebligat, alıcının elektronik adresine ulaştığı tarihi izleyen 5. günün sonunda, okunmasa da tebliğ edilmiş sayılır. Portal her tebligat için bu tarihi ayrıca gösterir.",
          "Bu yüzden ana sayfada incelenmemiş tebligatlar \"Yapılacaklar\" listesinde üst sıralarda yer alır.",
        ],
        link: { href: "/tebligat", label: "e-Tebligat" },
      },
    ],
  },
  {
    id: "fatura-bordro",
    title: "Faturalar ve bordro",
    items: [
      {
        id: "fatura-yukleme",
        q: "Faturaları nasıl yüklerim?",
        a: [
          "Mükellefin e-Fatura / e-Arşiv entegratörünün portalından faturaları XML (UBL) olarak ya da toplu ZIP olarak indirin ve Faturalar sayfasında \"Fatura yükle\" ile bırakın.",
          "Satıcının VKN'si bir mükellefinize uyuyorsa fatura o mükellefin satışı, alıcının VKN'si uyuyorsa alışı olarak kaydedilir. Aynı fatura (ETTN) ikinci kez yüklenirse atlanır.",
        ],
        link: { href: "/faturalar", label: "Faturalar" },
      },
      {
        id: "kdv-on-kontrol",
        q: "KDV ön kontrol beyannamenin yerine geçer mi?",
        a: [
          "Hayır. Sadece portala yüklediğiniz e-Fatura ve e-Arşiv faturalarına dayanır. Şunlar hesaba dahil değildir:",
          "- Önceki dönemden devreden KDV",
          "- İthalat, serbest meslek makbuzu, gider pusulası ve ÖKC fişleri",
          "- İndirim ve istisna hesapları",
          "Amacı, beyanname hazırlanırken büyük bir eksik veya fazlalığı erken fark etmenizdir.",
        ],
      },
      {
        id: "bordro-program",
        q: "Bordroyu hangi programdan yükleyebilirim?",
        a: [
          "Personel bazlı bordro listesini Excel (.xlsx) veya CSV olarak verebilen her programdan. Sütun adları programdan programa değişse de çoğu durumda tanınır.",
          "Zorunlu sütunlar T.C. Kimlik No, Gün ve SGK Matrahı. Üstteki firma/dönem başlıkları ve alttaki TOPLAM satırı sorun değildir. Emin değilseniz yükleme penceresindeki örnek şablonu kullanın.",
          "Portal bordroyu hesaplamaz; programınızın sonucunu saklar ve kontrol eder.",
        ],
        link: { href: "/bordro", label: "Bordro" },
      },
      {
        id: "bordro-fark",
        q: "Bordro e-Bildirge ile uyuşmuyor görünüyor. Ne yapmalıyım?",
        a: [
          "Bordro satırına tıklayın; sigortalı sayısı, prim günü ve PEK için bordrodaki ve e-Bildirge'deki değerler yan yana gösterilir.",
          "Sık görülen nedenler: ek veya iptal belgesinin henüz aktarılmamış olması, bir personelin eksik günlü bildirilmesi ya da bordronun güncel olmayan bir sürümünün yüklenmesi. Bordroyu yeniden yüklerseniz öncekinin yerine geçer.",
        ],
      },
    ],
  },
  {
    id: "asistan",
    title: "Uzmana Sor",
    items: [
      {
        id: "asistan-gizlilik",
        q: "Sorduğum sorular nereye gidiyor?",
        a: [
          "Sorunuz yapay zekâ servisine gönderilir. Göndermeden önce TCKN, VKN, IBAN, SGK sicil no, telefon ve e-posta otomatik gizlenir; neyin gizlendiği mesajınızın altında gösterilir.",
          "Portaldaki firma, beyanname ve SGK verileriniz asistana gönderilmez. Sohbetlerinizi sadece siz görürsünüz; büro yöneticisi de göremez.",
          "İsimler otomatik gizlenemez; sorularınıza mükellef adı yazmayın.",
        ],
        link: { href: "/asistan", label: "Uzmana Sor" },
      },
      {
        id: "asistan-kesinlik",
        q: "Asistanın cevaplarına güvenebilir miyim?",
        a: [
          "Cevaplar bilgi amaçlıdır ve mesleki değerlendirmenin yerini tutmaz. Asistan dayanak olarak kanun ve madde göstermeye çalışır.",
          "Oran, tutar ve had gibi her yıl değişen bilgileri mutlaka GİB, SGK veya Resmî Gazete'den doğrulayın.",
        ],
      },
    ],
  },
  {
    id: "hesap",
    title: "Hesap, güvenlik ve lisans",
    items: [
      {
        id: "roller",
        q: "Personel kullanıcılar neleri yapamaz?",
        a: [
          "Şunlar yalnızca yöneticiye açıktır:",
          "- Kullanıcı ekleme, şifre ve iki adımlı doğrulama sıfırlama",
          "- Excel'den toplu mükellef aktarımı",
          "- Lisans satın alma ve fatura bilgilerini düzenleme",
          "Diğer bütün ekranları personel de kullanabilir.",
        ],
      },
      {
        id: "iki-adim",
        q: "İki adımlı doğrulamayı nasıl açarım?",
        a: [
          "Ayarlar sayfasında güvenlik bölümünden kurulumu başlatın ve telefonunuzdaki doğrulayıcı uygulamayla karekodu okutun.",
          "Size verilen kurtarma kodlarını güvenli bir yere kaydedin. Telefonunuza erişemediğinizde giriş ekranında bu kodlardan birini kullanabilirsiniz; her kod bir kez geçerlidir.",
        ],
        link: { href: "/ayarlar", label: "Ayarlar" },
      },
      {
        id: "iki-adim-zorunlu",
        q: "İki adımlı doğrulamayı bütün personele zorunlu yapabilir miyim?",
        a: [
          "Evet. Yönetici Kullanıcılar sayfasındaki \"İki adımlı doğrulama zorunlu\" anahtarını açar. Bunun için önce kendi hesabında iki adımlı doğrulamanın açık olması gerekir.",
          "Zorunluluk açıkken iki adımlı doğrulaması olmayan kullanıcı girişte kurulum ekranına yönlendirilir; kurmadan hiçbir sayfayı açamaz ve tarayıcı eklentisinin anahtarı da çalışmaz. Kuran kullanıcı doğrulamayı kendi başına kapatamaz.",
          "Telefonunu kaybeden personelin doğrulamasını yönetici Kullanıcılar sayfasından sıfırlayabilir; kullanıcı bir sonraki girişte yeniden kurar.",
        ],
        link: { href: "/kullanicilar", label: "Kullanıcılar" },
      },
      {
        id: "sifre-unuttum",
        q: "Şifremi unuttum ya da hesabım kilitlendi.",
        a: [
          "Art arda 5 hatalı denemeden sonra hesap 15 dakika kilitlenir; süre dolunca tekrar deneyebilirsiniz.",
          "Şifrenizi unuttuysanız büronuzun yöneticisi Kullanıcılar sayfasından size geçici şifre verebilir. İlk girişte yeni şifrenizi belirlemeniz istenir.",
        ],
      },
      {
        id: "kota",
        q: "Mükellef kotam dolarsa ne olur?",
        a: [
          "Yeni mükellef eklenemez; mevcut mükellefleriniz ve verileri olduğu gibi kalır. Daha büyük bir pakete geçmek için Lisans ve ödeme sayfasını kullanın.",
          "Pasif mükellefler de kotaya sayılır.",
        ],
        link: { href: "/odeme", label: "Lisans ve ödeme" },
      },
      {
        id: "kart",
        q: "Kart bilgilerim portalda saklanıyor mu?",
        a: ["Hayır. Kart bilgisi iyzico'nun güvenli ödeme sayfasında girilir ve portala hiç gelmez. Ödeme tamamlandığında lisans süreniz kendiliğinden uzar."],
      },
    ],
  },
];
