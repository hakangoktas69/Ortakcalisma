// Yenilikler. En yeni kayıt en üstte. Yeni bir sürüm çıktığında başa bir kayıt ekleyin; kenar çubuğundaki
// "Yenilikler" işareti, kullanıcının görmediği en yeni kaydın id'sine göre yanar.

export type ChangeKind = "new" | "improved" | "fixed";

export interface ChangeEntry {
  id: string;
  date: string; // YYYY-MM-DD
  title: string;
  summary: string;
  changes: { kind: ChangeKind; text: string; href?: string }[];
}

export const CHANGE_KIND_LABEL: Record<ChangeKind, string> = { new: "Yeni", improved: "İyileştirme", fixed: "Düzeltme" };

export const CHANGELOG: ChangeEntry[] = [
  {
    id: "2026-10-19-2fa-zorunlu",
    date: "2026-10-19",
    title: "İki adımlı doğrulama zorunluluğu",
    summary: "Yönetici, büro personelinin tamamına iki adımlı doğrulamayı zorunlu tutabilir.",
    changes: [
      { kind: "new", text: "Kullanıcılar sayfasında \"İki adımlı doğrulama zorunlu\" ayarı; kurmamış kullanıcı sayısı gösterilir.", href: "/kullanicilar" },
      { kind: "new", text: "Zorunluluk açıkken kurmamış kullanıcı girişte kurulum ekranına yönlenir; kurmadan portal ve eklenti anahtarı çalışmaz." },
      { kind: "improved", text: "Zorunluluk açıkken kullanıcılar doğrulamayı kendi başına kapatamaz; telefon değişiminde yönetici sıfırlar." },
    ],
  },
  {
    id: "2026-10-19-is-kutusu",
    date: "2026-10-19",
    title: "İş kutusu",
    summary: "Açılış sayfası artık sayı kutuları değil, tek tek işlerden oluşan bir iş listesi; ekran sade ve açık.",
    changes: [
      { kind: "new", text: "İş kutusu: beyanname, tebligat, e-rapor, e-Defter, bordro ve lisans işleri tek listede, en acil üstte.", href: "/" },
      { kind: "new", text: "İşin yanında doğrudan işlem: verildi / incelendi / yüklendi olarak işaretleme." },
      { kind: "new", text: "Sonra hatırlat: işleri yarına, 3 gün sonrasına veya gelecek haftaya erteleme (büro genelinde)." },
      { kind: "improved", text: "Dar ikon menüsü; yardım ve hesap işlemleri sol alttaki menülerde. Varsayılan tema açık." },
      { kind: "improved", text: "Eski özet ekranı \"Genel bakış\" adıyla menüde.", href: "/ozet" },
    ],
  },
  {
    id: "2026-10-13-yardim",
    date: "2026-10-13",
    title: "Yardım sayfaları",
    summary: "Sık sorulan sorular ve bu sayfa eklendi; SGK kurum bilgileri artık ekrandan silinebiliyor.",
    changes: [
      { kind: "new", text: "Sıkça Sorulan Sorular: kurulumdan güvenliğe, aramalı ve konu başlıklı.", href: "/sss" },
      { kind: "new", text: "Yenilikler sayfası; okumadığınız yenilik olduğunda menüde işaret çıkar.", href: "/yenilikler" },
      { kind: "improved", text: "SGK İşyerleri: kayıtlı Vizite ve 4A bilgilerini tek tıkla silme (ikinci onaylı).", href: "/sgk" },
    ],
  },
  {
    id: "2026-10-13-gorunum",
    date: "2026-10-13",
    title: "Yeni görünüm",
    summary: "Portal kendine ait bir görünüme kavuştu; ana sayfa artık sayılar yerine yapılacak işleri gösteriyor.",
    changes: [
      { kind: "new", text: "\"Bugün\" ekranı: en acil işler üstte, haftanın vergi son günleri ajanda olarak.", href: "/" },
      { kind: "new", text: "Ctrl+K arama: mükellef, sayfa ve işlemleri her yerden bulun." },
      { kind: "new", text: "Koyu tema: menünün altından açık, sistem veya koyu seçin." },
      { kind: "improved", text: "Gruplu ve daraltılabilir menü; telefonda açılır menü." },
      { kind: "improved", text: "Yeni giriş ekranı." },
    ],
  },
  {
    id: "2026-10-13-bordro",
    date: "2026-10-13",
    title: "Bordro takibi",
    summary: "Bordro programınızın Excel çıktısını yükleyin; portal e-Bildirge ile karşılaştırsın.",
    changes: [
      { kind: "new", text: "Herhangi bir bordro programının Excel/CSV çıktısını yükleme; sütunlar adlarından tanınır.", href: "/bordro" },
      { kind: "new", text: "Bordro ile e-Bildirge mutabakatı: sigortalı sayısı, prim günü ve PEK." },
      { kind: "new", text: "e-Bildirge'si verilmiş ama bordrosu yüklenmemiş işyerleri listesi." },
      { kind: "new", text: "Satır kontrolleri: SGK işçi payı %14, işsizlik işçi payı %1, en fazla 30 gün." },
    ],
  },
  {
    id: "2026-10-13-fatura",
    date: "2026-10-13",
    title: "Faturalar ve KDV ön kontrol",
    summary: "Entegratörden indirdiğiniz e-Fatura ve e-Arşiv dosyalarıyla aylık KDV tablosu.",
    changes: [
      { kind: "new", text: "UBL-TR XML ve ZIP yükleme; faturalar VKN'ye göre mükellefin satışı veya alışı olarak eşleşir.", href: "/faturalar" },
      { kind: "new", text: "KDV ön kontrol: hesaplanan, indirilecek, tevkifat, KDV2 ve fark; oran kırılımıyla." },
      { kind: "fixed", text: "Excel'den firma aktarımında dosya türü kontrolü düzeltildi." },
    ],
  },
  {
    id: "2026-10-13-asistan",
    date: "2026-10-13",
    title: "Uzmana Sor",
    summary: "Vergi ve SGK mevzuatı hakkında genel sorular için yapay zekâ asistanı.",
    changes: [
      { kind: "new", text: "Akan yanıt, sohbet geçmişi ve örnek sorular.", href: "/asistan" },
      { kind: "new", text: "TCKN, VKN, IBAN, sicil no, telefon ve e-posta soru gönderilmeden otomatik gizlenir." },
      { kind: "fixed", text: "Ödeme sonrası \"Ödeme alındı\" mesajı artık sayfa açılırken doğru görünüyor." },
    ],
  },
  {
    id: "2026-10-13-ebildirge",
    date: "2026-10-13",
    title: "e-Bildirge aktarımı",
    summary: "SGK e-Bildirge'deki onaylı belgeler tarayıcı eklentisiyle portala gelir.",
    changes: [
      { kind: "new", text: "SGK sayfasında e-Bildirge sekmesi; ana sayfada güncel çalışan sayısı.", href: "/sgk" },
      { kind: "improved", text: "Tarayıcı eklentisi artık SGK sayfalarında da çalışıyor; işyeri sicil numarasından bulunuyor." },
      { kind: "fixed", text: "Eklentide elle girilen VKN/TCKN'deki boşluk ve işaretler doğru temizleniyor." },
    ],
  },
  {
    id: "2026-10-13-hesap",
    date: "2026-10-13",
    title: "Kullanıcılar, güvenlik ve ödeme",
    summary: "Büronuza personel ekleyin, hesabınızı iki adımlı doğrulamayla koruyun, lisansı çevrim içi uzatın.",
    changes: [
      { kind: "new", text: "Kullanıcı yönetimi: yönetici ve personel rolleri, geçici şifre.", href: "/kullanicilar" },
      { kind: "new", text: "İki adımlı doğrulama ve tek kullanımlık kurtarma kodları.", href: "/ayarlar" },
      { kind: "new", text: "Art arda hatalı girişte hesabı geçici kilitleme." },
      { kind: "new", text: "Excel'den toplu mükellef aktarımı.", href: "/firmalar" },
      { kind: "new", text: "iyzico ile lisans ödemesi; kart bilgisi portala gelmez.", href: "/odeme" },
    ],
  },
  {
    id: "2026-10-12-ilk",
    date: "2026-10-12",
    title: "İlk sürüm",
    summary: "Mükellef takibinin temeli: beyanname, tebligat, SGK, e-Defter ve bildirimler.",
    changes: [
      { kind: "new", text: "Mükellefler, vergi takvimi ve lisans/kota takibi." },
      { kind: "new", text: "Beyanname kontrolü: kim verdi, kim bekliyor, kim gecikti.", href: "/beyanname" },
      { kind: "new", text: "GİB sayfasından beyanname ve e-tebligat aktaran tarayıcı eklentisi." },
      { kind: "new", text: "SGK e-rapor (Vizite) ve işe giriş / işten çıkış takibi." },
      { kind: "new", text: "Bildirim merkezi, otomatik hatırlatıcılar ve WhatsApp bildirimi." },
      { kind: "new", text: "e-Defter berat takibi, dilekçe şablonları ve CSV raporlar." },
    ],
  },
];

export const LATEST_CHANGE_ID = CHANGELOG[0].id;
