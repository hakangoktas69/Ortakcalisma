import {
  BookCheck,
  Building2,
  CircleHelp,
  CreditCard,
  FilePen,
  FileSpreadsheet,
  FileText,
  Inbox,
  LayoutGrid,
  Mail,
  Megaphone,
  ReceiptText,
  Settings,
  ShieldCheck,
  Sparkles,
  Users,
  Wallet,
  type LucideIcon,
} from "lucide-react";

export interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  /** Komut paletinde aramayı kolaylaştıran ek kelimeler */
  keywords?: string;
  /** Sadece görünürlük içindir; yetki kontrolü sunucuda yapılır */
  adminOnly?: boolean;
  /** Menüde okunmamış işareti gösterilecek öğe */
  badge?: "changelog";
}

export interface NavGroup {
  /** Grubun nerede gösterileceği: sol ikon şeridi, yardım menüsü ya da hesap menüsü */
  area: "rail" | "help" | "account";
  title: string | null;
  /** Üst menüde açılır grup olarak gösterilecekse grubun kısa adı; yoksa öğeler doğrudan bağlantıdır */
  menu?: string;
  items: NavItem[];
}

export const NAV: NavGroup[] = [
  {
    area: "rail",
    title: null,
    items: [
      { href: "/", label: "İş kutusu", icon: Inbox, keywords: "bugün yapılacaklar görevler işler ana sayfa" },
      { href: "/ozet", label: "Genel bakış", icon: LayoutGrid, keywords: "özet panel istatistik dashboard" },
      { href: "/firmalar", label: "Mükellefler", icon: Building2, keywords: "firmalar şirket şahıs vkn" },
    ],
  },
  {
    area: "rail",
    title: "Beyan ve tebligat",
    menu: "Beyan",
    items: [
      { href: "/beyanname", label: "Beyannameler", icon: FileText, keywords: "e-beyanname kdv muhtasar kontrol" },
      { href: "/tebligat", label: "e-Tebligat", icon: Mail, keywords: "tebligat gib" },
      { href: "/edefter", label: "e-Defter", icon: BookCheck, keywords: "berat defter" },
    ],
  },
  {
    area: "rail",
    title: "SGK ve personel",
    menu: "SGK",
    items: [
      { href: "/sgk", label: "SGK", icon: ShieldCheck, keywords: "vizite rapor işe giriş çıkış e-bildirge" },
      { href: "/bordro", label: "Bordro", icon: Wallet, keywords: "maaş ücret mutabakat" },
    ],
  },
  {
    area: "rail",
    title: "Muhasebe",
    menu: "Muhasebe",
    items: [
      { href: "/faturalar", label: "Faturalar", icon: ReceiptText, keywords: "e-fatura e-arşiv kdv ubl" },
      { href: "/raporlar", label: "Raporlar", icon: FileSpreadsheet, keywords: "csv excel dışa aktar" },
      { href: "/dilekceler", label: "Dilekçeler", icon: FilePen, keywords: "pişmanlık izaha davet şablon" },
    ],
  },
  {
    area: "rail",
    title: "Araçlar",
    items: [{ href: "/asistan", label: "Uzmana Sor", icon: Sparkles, keywords: "asistan yapay zeka mevzuat soru" }],
  },
  {
    area: "help",
    title: "Yardım",
    items: [
      { href: "/sss", label: "Sıkça sorulanlar", icon: CircleHelp, keywords: "sss yardım soru destek nasıl" },
      { href: "/yenilikler", label: "Yenilikler", icon: Megaphone, keywords: "sürüm güncelleme değişiklik yeni özellik", badge: "changelog" },
    ],
  },
  {
    area: "account",
    title: "Büro",
    items: [
      { href: "/ayarlar", label: "Ayarlar", icon: Settings, keywords: "güvenlik 2fa bildirim whatsapp" },
      { href: "/kullanicilar", label: "Kullanıcılar", icon: Users, keywords: "personel yetki", adminOnly: true },
      { href: "/odeme", label: "Lisans ve ödeme", icon: CreditCard, keywords: "abonelik paket iyzico kota" },
    ],
  },
];

export const isActivePath = (href: string, pathname: string) => (href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(`${href}/`));
