// Sistemin hazır dilekçe şablonları. Bunlar ÖRNEK metinlerdir: kullanıcı göndermeden önce
// içeriği kendi durumuna göre kontrol edip düzenler. {{alan}} yer tutucuları belge üretilirken doldurulur.
//
// Otomatik dolan alanlar: firma_unvani, vkn, vergi_dairesi, tarih, buro_adi, kullanici_adi.
// Diğer alanlar (konu, aciklama, donem…) formda kullanıcıya sorulur.

export interface BuiltinTemplate {
  key: string;
  title: string;
  category: 'Vergi dairesi' | 'SGK' | 'Genel';
  body: string;
}

export const BUILTIN_TEMPLATES: BuiltinTemplate[] = [
  {
    key: 'genel-vergi-dairesi',
    title: 'Vergi dairesine genel dilekçe',
    category: 'Vergi dairesi',
    body: `{{vergi_dairesi}} VERGİ DAİRESİ MÜDÜRLÜĞÜNE

Konu: {{konu}}

Dairenizin {{vkn}} vergi kimlik numaralı mükellefiyiz.

{{aciklama}}

Gereğinin yapılmasını saygılarımızla arz ederiz. {{tarih}}

{{firma_unvani}}
Vergi Kimlik No: {{vkn}}
Adres: {{adres}}`,
  },
  {
    key: 'pismanlik',
    title: 'Pişmanlıkla beyan dilekçesi (VUK 371)',
    category: 'Vergi dairesi',
    body: `{{vergi_dairesi}} VERGİ DAİRESİ MÜDÜRLÜĞÜNE

Konu: Pişmanlıkla beyan

Dairenizin {{vkn}} vergi kimlik numaralı mükellefiyiz. {{donem}} dönemine ait {{beyanname_turu}} beyannamemizi, 213 sayılı Vergi Usul Kanunu'nun 371. maddesi kapsamında pişmanlık hükümlerinden yararlanmak suretiyle ekte sunuyoruz.

Pişmanlık zammı ile birlikte tahakkuk edecek vergiyi kanuni süresi içinde ödeyeceğimizi beyan eder, gereğinin yapılmasını arz ederiz. {{tarih}}

{{firma_unvani}}
Vergi Kimlik No: {{vkn}}

Ek: {{beyanname_turu}} beyannamesi ({{donem}})`,
  },
  {
    key: 'izaha-davet',
    title: 'İzaha davete cevap (VUK 370)',
    category: 'Vergi dairesi',
    body: `{{vergi_dairesi}} VERGİ DAİRESİ MÜDÜRLÜĞÜNE

Konu: {{yazi_tarihi}} tarihli ve {{yazi_sayisi}} sayılı izaha davet yazınıza cevabımızdır.

Dairenizin {{vkn}} vergi kimlik numaralı mükellefiyiz. İlgi yazınız ile 213 sayılı Vergi Usul Kanunu'nun 370. maddesi kapsamında izaha davet edilmiş bulunmaktayız. Konuya ilişkin açıklamalarımız aşağıdadır:

{{aciklama}}

Açıklamalarımızın ve ekte sunulan belgelerin değerlendirilmesini saygılarımızla arz ederiz. {{tarih}}

{{firma_unvani}}
Vergi Kimlik No: {{vkn}}

Ekler: {{ekler}}`,
  },
  {
    key: 'uzlasma',
    title: 'Uzlaşma talep dilekçesi',
    category: 'Vergi dairesi',
    body: `{{vergi_dairesi}} VERGİ DAİRESİ MÜDÜRLÜĞÜNE

Konu: Uzlaşma talebi

Dairenizin {{vkn}} vergi kimlik numaralı mükellefiyiz. Tarafımıza {{teblig_tarihi}} tarihinde tebliğ edilen {{ihbarname_tarihi}} tarih ve {{ihbarname_no}} sayılı vergi/ceza ihbarnamesi ile tarh edilen vergi ve kesilen cezalar için 213 sayılı Vergi Usul Kanunu hükümleri çerçevesinde uzlaşma talep ediyoruz.

{{aciklama}}

Gereğinin yapılmasını saygılarımızla arz ederiz. {{tarih}}

{{firma_unvani}}
Vergi Kimlik No: {{vkn}}`,
  },
  {
    key: 'borcu-yoktur',
    title: 'Vergi borcu yoktur yazısı talebi',
    category: 'Vergi dairesi',
    body: `{{vergi_dairesi}} VERGİ DAİRESİ MÜDÜRLÜĞÜNE

Dairenizin {{vkn}} vergi kimlik numaralı mükellefiyiz. {{kullanim_yeri}} kurumuna ibraz edilmek üzere, vadesi geçmiş vergi borcumuzun bulunmadığına dair yazının tarafımıza verilmesini saygılarımızla arz ederiz. {{tarih}}

{{firma_unvani}}
Vergi Kimlik No: {{vkn}}`,
  },
  {
    key: 'sgk-ipc-itiraz',
    title: 'SGK idari para cezasına itiraz',
    category: 'SGK',
    body: `SOSYAL GÜVENLİK KURUMU {{sgk_il_mudurlugu}} SOSYAL GÜVENLİK İL MÜDÜRLÜĞÜNE / MERKEZİNE

Konu: İdari para cezasına itiraz

İşyeri Sicil No: {{isyeri_sicil_no}}

Kurumunuzca düzenlenen ve tarafımıza {{teblig_tarihi}} tarihinde tebliğ edilen {{ceza_tarihi}} tarih ve {{ceza_sayisi}} sayılı idari para cezasına, 5510 sayılı Kanun'un 102. maddesi kapsamında süresi içinde itiraz ediyoruz.

İtiraz gerekçelerimiz:
{{aciklama}}

Açıklanan nedenlerle idari para cezasının iptalini saygılarımızla arz ederiz. {{tarih}}

{{firma_unvani}}
Vergi Kimlik No: {{vkn}}

Ekler: {{ekler}}`,
  },
];

/** Otomatik doldurulan alanların kullanıcıya gösterilecek adları; diğerleri alan adından üretilir. */
export const FIELD_LABELS: Record<string, string> = {
  firma_unvani: 'Firma unvanı',
  vkn: 'VKN / TCKN',
  vergi_dairesi: 'Vergi dairesi',
  tarih: 'Tarih',
  buro_adi: 'Büro adı',
  kullanici_adi: 'Hazırlayan',
  konu: 'Konu',
  aciklama: 'Açıklama',
  adres: 'Adres',
  donem: 'Dönem',
  beyanname_turu: 'Beyanname türü',
  yazi_tarihi: 'Yazı tarihi',
  yazi_sayisi: 'Yazı sayısı',
  ekler: 'Ekler',
  teblig_tarihi: 'Tebliğ tarihi',
  ihbarname_tarihi: 'İhbarname tarihi',
  ihbarname_no: 'İhbarname no',
  kullanim_yeri: 'Kullanılacağı yer',
  sgk_il_mudurlugu: 'SGK il müdürlüğü / merkezi',
  isyeri_sicil_no: 'İşyeri sicil no',
  ceza_tarihi: 'Ceza tarihi',
  ceza_sayisi: 'Ceza sayısı',
};

/** Metindeki {{alan}} adlarını sırasıyla, tekrarsız döner. */
export function placeholders(body: string): string[] {
  return [...new Set([...body.matchAll(/\{\{([a-z_]+)\}\}/g)].map((m) => m[1]))];
}

/** Yer tutucuları verilen değerlerle doldurur; değeri olmayanlar olduğu gibi kalır. */
export function fill(body: string, values: Record<string, string | undefined>): string {
  return body.replace(/\{\{([a-z_]+)\}\}/g, (all, key: string) => {
    const v = values[key];
    return v !== undefined && v.trim() !== '' ? v : all;
  });
}

export function fieldLabel(key: string): string {
  return FIELD_LABELS[key] ?? key.replace(/_/g, ' ').replace(/^./, (c) => c.toUpperCase());
}
