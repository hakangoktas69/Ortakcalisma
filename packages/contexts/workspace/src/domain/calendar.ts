import { err, ok, type Result } from '@eworks/kernel';

// Mali müşavir takvimi (Mert'in 26.10 takvimi; yeni yapıda kaynaklı ve doğrulanmış). Saf hesap: tarihler 'YYYY-MM-DD' metni,
// gün aritmetiği UTC'de (saat dilimi kayması yok). Kaynaklar:
// - tatil: 2429 sayılı Kanun'daki sabit tatiller (kesin) + dinî bayramlar (kaynaktan; kaynak kesin değilse "kesinleşmedi");
// - gib: GİB vergi takvimi kaynak verisi (resmî, fail-closed doğrulanır);
// - kural: mevzuattan hesaplanan tarih (SGK prim son günü; kesinleşmedi, resmî kaynaktan kontrol edilmeli) ve dönem sonları.

export type CalendarCategory = 'beyan' | 'odeme' | 'bildirim' | 'berat' | 'personel' | 'tatil' | 'donem' | 'diger';
export type CalendarSource = 'gib' | 'tatil' | 'kural';
export type Certainty = 'kesin' | 'kesinlesmedi';

export type CalendarEntry = {
  readonly key: string;
  readonly date: string;
  readonly title: string;
  readonly description: string;
  readonly category: CalendarCategory;
  readonly source: CalendarSource;
  readonly certainty: Certainty;
  readonly halfDay: boolean;
  readonly period: string | null;
  readonly sourceUrl: string | null;
  readonly checkedAt: string | null;
  readonly reference: string | null;
};

export const CALENDAR_CATEGORIES: readonly { id: CalendarCategory; title: string }[] = [
  { id: 'beyan', title: 'Beyanname' },
  { id: 'odeme', title: 'Ödeme' },
  { id: 'bildirim', title: 'Bildirim' },
  { id: 'berat', title: 'e-Defter berat' },
  { id: 'personel', title: 'Personel ve SGK' },
  { id: 'tatil', title: 'Resmî tatil' },
  { id: 'donem', title: 'Dönem sonu' },
  { id: 'diger', title: 'Diğer' },
];
export const CALENDAR_SOURCES: readonly { id: CalendarSource; title: string }[] = [
  { id: 'gib', title: 'GİB vergi takvimi' },
  { id: 'tatil', title: 'Resmî tatiller' },
  { id: 'kural', title: 'Mevzuat kuralı' },
];

const AYLAR = ['Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran', 'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık'];
const GUN = /^(\d{4})-(\d{2})-(\d{2})$/;

/** Takvimde var olan bir gün mü? (2027-02-30 değil) */
export function validDate(s: string): boolean {
  const m = GUN.exec(s);
  if (!m) return false;
  const d = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])));
  return d.toISOString().slice(0, 10) === s;
}
const utc = (s: string) => new Date(`${s}T00:00:00Z`);
const iso = (d: Date) => d.toISOString().slice(0, 10);
export const addDays = (s: string, n: number) => iso(new Date(utc(s).getTime() + n * 86_400_000));
const pad = (n: number) => String(n).padStart(2, '0');
const lastDayOfMonth = (y: number, m: number) => iso(new Date(Date.UTC(y, m, 0)));

const entry = (e: Omit<CalendarEntry, 'halfDay' | 'period' | 'sourceUrl' | 'checkedAt' | 'reference'> & Partial<CalendarEntry>): CalendarEntry => ({
  halfDay: false,
  period: null,
  sourceUrl: null,
  checkedAt: null,
  reference: null,
  ...e,
});

const KANUN_2429 = 'https://www.mevzuat.gov.tr/mevzuat?MevzuatNo=2429&MevzuatTur=1&MevzuatTertip=5';
const SABIT: readonly [string, string, boolean][] = [
  ['01-01', 'Yılbaşı', false],
  ['04-23', 'Ulusal Egemenlik ve Çocuk Bayramı', false],
  ['05-01', 'Emek ve Dayanışma Günü', false],
  ['05-19', 'Atatürk’ü Anma, Gençlik ve Spor Bayramı', false],
  ['07-15', 'Demokrasi ve Millî Birlik Günü', false],
  ['08-30', 'Zafer Bayramı', false],
  ['10-28', 'Cumhuriyet Bayramı arifesi (13.00 sonrası)', true],
  ['10-29', 'Cumhuriyet Bayramı', false],
];

/** 2429 sayılı Ulusal Bayram ve Genel Tatiller Hakkında Kanun'daki sabit tarihli tatiller. */
export const nationalHolidays = (year: number): CalendarEntry[] =>
  SABIT.map(([gun, title, halfDay]) =>
    entry({
      key: `tatil:${year}-${gun}`,
      date: `${year}-${gun}`,
      title,
      description: halfDay ? 'Yarım gün resmî tatil.' : 'Resmî tatil.',
      category: 'tatil',
      source: 'tatil',
      certainty: 'kesin',
      halfDay,
      sourceUrl: KANUN_2429,
      reference: '2429 sayılı Kanun',
    }),
  );

export type ReligiousDates = { ramazan: string; kurban: string };
export type SourceInfo = { certain: boolean; sourceUrl: string | null; checkedAt: string | null };

/** Ramazan (3 gün) ve Kurban (4 gün) Bayramı ilk günlerinden tatil günleri; arifeler 13.00 sonrası yarım gün. */
export function religiousHolidays(year: number, d: ReligiousDates, s: SourceInfo): Result<CalendarEntry[], 'gecersiz_bayram'> {
  const out: CalendarEntry[] = [];
  for (const [ad, ilk, gunSayisi] of [['Ramazan', d.ramazan, 3], ['Kurban', d.kurban, 4]] as const) {
    if (!validDate(ilk) || !ilk.startsWith(`${year}-`)) return err('gecersiz_bayram');
    const ortak = { category: 'tatil' as const, source: 'tatil' as const, certainty: s.certain ? ('kesin' as const) : ('kesinlesmedi' as const), sourceUrl: s.sourceUrl, checkedAt: s.checkedAt };
    const arife = addDays(ilk, -1);
    // Anahtar bayram adını taşır: dinî bayram günü sabit bir tatile denk gelebilir (Kurban 2027 4. gün = 19 Mayıs)
    out.push(entry({ ...ortak, key: `tatil:${ad.toLocaleLowerCase('tr-TR')}:${arife}`, date: arife, title: `${ad} Bayramı arifesi (13.00 sonrası)`, description: 'Yarım gün resmî tatil.', halfDay: true }));
    for (let i = 0; i < gunSayisi; i++) {
      const g = addDays(ilk, i);
      out.push(entry({ ...ortak, key: `tatil:${ad.toLocaleLowerCase('tr-TR')}:${g}`, date: g, title: `${ad} Bayramı ${i + 1}. gün`, description: 'Resmî tatil.' }));
    }
  }
  return ok(out);
}

/** Tam gün tatillerin tarihleri (yarım gün iş günüdür). */
export const holidayDates = (entries: readonly CalendarEntry[]): ReadonlySet<string> => new Set(entries.filter((e) => e.category === 'tatil' && !e.halfDay).map((e) => e.date));

export function isWorkday(date: string, holidays: ReadonlySet<string>): boolean {
  const g = utc(date).getUTCDay();
  return g !== 0 && g !== 6 && !holidays.has(date);
}

/** Son gün tatile ya da hafta sonuna rastlarsa izleyen ilk iş günü. */
export function nextWorkday(date: string, holidays: ReadonlySet<string>): string {
  let d = date;
  while (!isWorkday(d, holidays)) d = addDays(d, 1);
  return d;
}

/** SGK primleri ait olduğu ayı izleyen ayın sonuna kadar ödenir (5510 sayılı Kanun md. 88). Takvim yılındaki 12 son gün. */
export const sgkPremiumEntries = (year: number, holidays: ReadonlySet<string>): CalendarEntry[] =>
  Array.from({ length: 12 }, (_, i) => {
    const ay = i + 1;
    const oncekiAy = ay === 1 ? 12 : ay - 1;
    const oncekiYil = ay === 1 ? year - 1 : year;
    const donem = `${AYLAR[oncekiAy - 1]} ${oncekiYil}`;
    return entry({
      key: `kural:sgk-prim:${oncekiYil}-${pad(oncekiAy)}`,
      date: nextWorkday(lastDayOfMonth(year, ay), holidays),
      title: 'SGK prim ödemesi son günü',
      description: `${donem} dönemi sigorta primlerinin ödenmesi. Son gün tatile ya da hafta sonuna rastlarsa izleyen ilk iş günü alınmıştır; resmî kaynaktan kontrol edin.`,
      category: 'personel',
      source: 'kural',
      certainty: 'kesinlesmedi',
      period: donem,
      reference: '5510 sayılı Kanun md. 88',
    });
  });

/** Çeyrek sonları (geçici vergi dönemleri) ve hesap dönemi sonu (takvim yılı). */
export const periodEntries = (year: number): CalendarEntry[] =>
  [3, 6, 9, 12].map((ay, i) =>
    entry({
      key: `kural:donem:${year}-q${i + 1}`,
      date: lastDayOfMonth(year, ay),
      title: ay === 12 ? 'Hesap dönemi sonu' : `${i + 1}. çeyrek (geçici vergi dönemi) sonu`,
      description: ay === 12 ? 'Takvim yılı hesap dönemi ve 4. çeyrek sonu.' : `${i + 1}. geçici vergi döneminin son günü.`,
      category: 'donem',
      source: 'kural',
      certainty: 'kesin',
    }),
  );

// GİB vergi takvimi kaynak verisi (Mert'in gözlediği gib.gov.tr vergi takvimi listesi; eworks.gib.tax-calendar.v1)
export type GibCalendarRecord = { id: number; title: string; description: string; stopdate: string; periodDescription: string; subject: string };
export type GibCalendarSnapshot = { schema: string; year: number; checkedAt: string; sourceUrl: string; count: number; records: readonly GibCalendarRecord[] };
export type GibCalendarError = 'gecersiz_kaynak' | 'sayi_uyusmuyor' | 'tekrarlanan_kayit' | 'yil_disi' | 'gecersiz_kayit';

const metin = (v: unknown, max: number): v is string => typeof v === 'string' && v.trim().length > 0 && v.length <= max;

function gibKategori(r: GibCalendarRecord): CalendarCategory {
  if (/muhtasar ve prim hizmet/iu.test(`${r.title} ${r.description}`)) return 'personel';
  if (r.subject === 'Berat') return 'berat';
  if (r.subject === 'Ödeme') return 'odeme';
  if (r.subject === 'Bildirim' || r.subject === 'Bildirim ve Ödeme') return 'bildirim';
  if (r.subject === 'Beyan ve Ödeme' || r.subject === 'Beyan') return 'beyan';
  return 'diger';
}

/** Kaynak verisini doğrular (fail-closed: tek hata tüm listeyi reddeder) ve takvim kayıtlarına çevirir. */
export function gibEntries(s: GibCalendarSnapshot, year: number): Result<CalendarEntry[], GibCalendarError> {
  if (s.schema !== 'eworks.gib.tax-calendar.v1' || s.year !== year || !validDate(s.checkedAt) || !/^https:\/\/gib\.gov\.tr\//.test(s.sourceUrl) || !Array.isArray(s.records)) {
    return err('gecersiz_kaynak');
  }
  if (s.count !== s.records.length) return err('sayi_uyusmuyor');
  if (new Set(s.records.map((r) => r.id)).size !== s.records.length) return err('tekrarlanan_kayit');
  const out: CalendarEntry[] = [];
  for (const r of s.records) {
    const tarih = typeof r.stopdate === 'string' ? r.stopdate.slice(0, 10) : '';
    if (!Number.isSafeInteger(r.id) || !validDate(tarih) || !metin(r.title, 500) || !metin(r.description, 4000) || !metin(r.subject, 100) || typeof r.periodDescription !== 'string') {
      return err('gecersiz_kayit');
    }
    if (!tarih.startsWith(`${year}-`)) return err('yil_disi');
    out.push(
      entry({
        key: `gib:${r.id}`,
        date: tarih,
        title: r.title.trim(),
        description: r.description.trim(),
        category: gibKategori(r),
        source: 'gib',
        certainty: 'kesin',
        period: r.periodDescription.trim() || null,
        sourceUrl: s.sourceUrl,
        checkedAt: s.checkedAt,
      }),
    );
  }
  return ok(out);
}

export type YearSources = { gib?: GibCalendarSnapshot; religious?: SourceInfo & { dates: ReligiousDates } };

/** Bir yılın takvimi: yasa + kaynak + kural. Kaynak doğrulanamazsa yıl hiç uygulanmaz (fail-closed). */
export function buildYear(year: number, s: YearSources): Result<CalendarEntry[], GibCalendarError | 'gecersiz_bayram'> {
  const tatiller = [...nationalHolidays(year)];
  if (s.religious) {
    const r = religiousHolidays(year, s.religious.dates, s.religious);
    if (!r.ok) return r;
    tatiller.push(...r.value);
  }
  const gib = s.gib ? gibEntries(s.gib, year) : ok<CalendarEntry[]>([]);
  if (!gib.ok) return gib;
  const hepsi = [...tatiller, ...gib.value, ...sgkPremiumEntries(year, holidayDates(tatiller)), ...periodEntries(year)];
  const tekil = new Map(hepsi.map((e) => [e.key, e]));
  return ok([...tekil.values()].sort((a, b) => a.date.localeCompare(b.date) || a.key.localeCompare(b.key)));
}
