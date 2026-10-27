import { describe, expect, it } from 'vitest';
import { buildYear, gibEntries, holidayDates, isWorkday, nationalHolidays, nextWorkday, periodEntries, religiousHolidays, sgkPremiumEntries } from '../../src/index.ts';

// Mali müşavir takvimi (Mert 26.10, 5a26d21): resmî tatiller (2429 sayılı Kanun), dinî bayramlar (kaynaktan, kesinleşmedi işaretiyle),
// GİB vergi takvimi (kaynak verisi, fail-closed), mevzuat kuralından hesaplanan tarihler (SGK prim son günü) ve dönem sonları.

const gibKaydi = (id: number, stopdate: string, subject = 'Beyan ve Ödeme', title = 'Katma Değer Vergisi Beyannamesi') => ({
  id,
  title,
  description: `${title} açıklaması`,
  stopdate: `${stopdate}T00:00:00`,
  periodDescription: 'Eylül 2026 Dönemi',
  subject,
});
const anlik = (records: ReturnType<typeof gibKaydi>[], o: Record<string, unknown> = {}) => ({
  schema: 'eworks.gib.tax-calendar.v1',
  year: 2026,
  checkedAt: '2026-10-26',
  sourceUrl: 'https://gib.gov.tr/vergi-takvimi',
  count: records.length,
  records,
  ...o,
});

describe('resmî tatiller', () => {
  it('2429 sayılı Kanun: sabit tatiller kesin; 28 Ekim yarım gün', () => {
    const t = nationalHolidays(2027);
    expect(t.map((e) => e.date)).toEqual(['2027-01-01', '2027-04-23', '2027-05-01', '2027-05-19', '2027-07-15', '2027-08-30', '2027-10-28', '2027-10-29']);
    expect(t.every((e) => e.source === 'tatil' && e.certainty === 'kesin' && e.category === 'tatil')).toBe(true);
    expect(t.find((e) => e.date === '2027-10-28')).toMatchObject({ halfDay: true });
    expect(new Set(t.map((e) => e.key)).size).toBe(t.length);
  });

  it('dinî bayramlar kaynaktan: arife yarım gün eklenir; kaynak kesin değilse işaretlenir', () => {
    const r = religiousHolidays(2027, { ramazan: '2027-03-10', kurban: '2027-05-16' }, { certain: false, sourceUrl: 'https://date.nager.at', checkedAt: '2027-01-02' });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.value.map((e) => [e.date, e.title])).toEqual([
      ['2027-03-09', 'Ramazan Bayramı arifesi (13.00 sonrası)'],
      ['2027-03-10', 'Ramazan Bayramı 1. gün'],
      ['2027-03-11', 'Ramazan Bayramı 2. gün'],
      ['2027-03-12', 'Ramazan Bayramı 3. gün'],
      ['2027-05-15', 'Kurban Bayramı arifesi (13.00 sonrası)'],
      ['2027-05-16', 'Kurban Bayramı 1. gün'],
      ['2027-05-17', 'Kurban Bayramı 2. gün'],
      ['2027-05-18', 'Kurban Bayramı 3. gün'],
      ['2027-05-19', 'Kurban Bayramı 4. gün'],
    ]);
    expect(r.value.every((e) => e.certainty === 'kesinlesmedi')).toBe(true);
    expect(r.value.filter((e) => e.halfDay).map((e) => e.date)).toEqual(['2027-03-09', '2027-05-15']);
  });

  it('başka yıla düşen ya da geçersiz bayram tarihi reddedilir', () => {
    expect(religiousHolidays(2027, { ramazan: '2026-03-20', kurban: '2027-05-16' }, { certain: true, sourceUrl: null, checkedAt: null }).ok).toBe(false);
    expect(religiousHolidays(2027, { ramazan: '2027-02-30', kurban: '2027-05-16' }, { certain: true, sourceUrl: null, checkedAt: null }).ok).toBe(false);
  });
});

describe('iş günü', () => {
  const tatil = holidayDates(nationalHolidays(2026));
  it('hafta sonu ve tam gün tatil iş günü değildir; yarım gün (28 Ekim) iş günüdür', () => {
    expect(isWorkday('2026-10-24', tatil)).toBe(false);
    expect(isWorkday('2026-10-25', tatil)).toBe(false);
    expect(isWorkday('2026-10-29', tatil)).toBe(false);
    expect(isWorkday('2026-10-28', tatil)).toBe(true);
    expect(isWorkday('2026-10-27', tatil)).toBe(true);
  });
  it('sonraki iş günü: tatil ve hafta sonunu atlar, ay ve yıl sınırını geçer', () => {
    expect(nextWorkday('2026-10-29', tatil)).toBe('2026-10-30');
    expect(nextWorkday('2026-05-01', tatil)).toBe('2026-05-04');
    expect(nextWorkday('2026-12-31', tatil)).toBe('2026-12-31');
    expect(nextWorkday('2027-01-01', holidayDates(nationalHolidays(2027)))).toBe('2027-01-04');
  });
});

describe('mevzuat kuralından hesaplanan tarihler', () => {
  it('SGK primi izleyen ayın sonunda ödenir (5510 md. 88); son gün tatilse ilk iş günü; kesinleşmedi işaretli', () => {
    const tatil = holidayDates(nationalHolidays(2026));
    const p = sgkPremiumEntries(2026, tatil);
    expect(p).toHaveLength(12);
    expect(p[0]).toMatchObject({ date: '2026-02-02', category: 'personel', source: 'kural', certainty: 'kesinlesmedi', period: 'Aralık 2025' });
    expect(p.find((e) => e.period === 'Nisan 2026')?.date).toBe('2026-06-01');
    expect(p.find((e) => e.period === 'Eylül 2026')?.date).toBe('2026-11-02');
    expect(p[0]!.reference).toContain('5510');
  });

  it('dönem sonları: çeyrekler (geçici vergi dönemi) ve hesap dönemi sonu kesin', () => {
    expect(periodEntries(2026).map((e) => [e.date, e.title])).toEqual([
      ['2026-03-31', '1. çeyrek (geçici vergi dönemi) sonu'],
      ['2026-06-30', '2. çeyrek (geçici vergi dönemi) sonu'],
      ['2026-09-30', '3. çeyrek (geçici vergi dönemi) sonu'],
      ['2026-12-31', 'Hesap dönemi sonu'],
    ]);
  });
});

describe('GİB vergi takvimi kaynağı', () => {
  it('kayıtlar kategoriye çevrilir; MUHSGK personel, berat ayrı', () => {
    const r = gibEntries(
      anlik([
        gibKaydi(1, '2026-10-28'),
        gibKaydi(2, '2026-10-26', 'Beyan ve Ödeme', 'Muhtasar ve Prim Hizmet Beyannamesi'),
        gibKaydi(3, '2026-10-31', 'Berat', 'Elektronik Defter Beratları'),
        gibKaydi(4, '2026-10-31', 'Ödeme', 'Motorlu Taşıtlar Vergisi'),
      ]),
      2026,
    );
    expect(r.ok && r.value.map((e) => [e.key, e.category])).toEqual([
      ['gib:1', 'beyan'],
      ['gib:2', 'personel'],
      ['gib:3', 'berat'],
      ['gib:4', 'odeme'],
    ]);
    expect(r.ok && r.value[0]).toMatchObject({ source: 'gib', certainty: 'kesin', sourceUrl: 'https://gib.gov.tr/vergi-takvimi', checkedAt: '2026-10-26', period: 'Eylül 2026 Dönemi' });
  });

  it('GİB MUHSGK\'yı açıklamada yazar ("… Muhtasar ve Prim Hizmet Beyannamesi ile Beyanı"): personel sayılır', () => {
    const k = { ...gibKaydi(5, '2026-10-26', 'Beyan ve Ödeme', 'Gelir ve Kurumlar Vergisi Tevkifatlarının Beyan ve Ödemesi'), description: 'Eylül 2026 Dönemine Ait Tevkifatların Muhtasar ve Prim Hizmet Beyannamesi ile Beyanı ve Ödemesi' };
    const r = gibEntries(anlik([k]), 2026);
    expect(r.ok && r.value[0]!.category).toBe('personel');
  });

  it('fail-closed: sayı uyuşmazlığı, tekrarlanan kimlik, başka yıl, bozuk tarih, şema dışı kaynak uygulanmaz', () => {
    const k = [gibKaydi(1, '2026-10-28'), gibKaydi(2, '2026-11-26')];
    expect(gibEntries(anlik(k, { count: 3 }), 2026)).toEqual({ ok: false, error: 'sayi_uyusmuyor' });
    expect(gibEntries(anlik([k[0]!, { ...k[1]!, id: 1 }]), 2026)).toEqual({ ok: false, error: 'tekrarlanan_kayit' });
    expect(gibEntries(anlik([gibKaydi(1, '2027-01-26')]), 2026)).toEqual({ ok: false, error: 'yil_disi' });
    expect(gibEntries(anlik([gibKaydi(1, '2026-13-01')]), 2026)).toEqual({ ok: false, error: 'gecersiz_kayit' });
    expect(gibEntries(anlik(k, { schema: 'baska' }), 2026)).toEqual({ ok: false, error: 'gecersiz_kaynak' });
    expect(gibEntries(anlik(k, { year: 2027 }), 2026)).toEqual({ ok: false, error: 'gecersiz_kaynak' });
  });
});

describe('yılın takvimi', () => {
  it('kaynaklar birleşir; anahtarlar tekil; tarih sırasında', () => {
    const y = buildYear(2026, {
      gib: anlik([gibKaydi(1, '2026-10-28')]),
      religious: { dates: { ramazan: '2026-03-20', kurban: '2026-05-27' }, certain: true, sourceUrl: 'https://vakithesaplama.diyanet.gov.tr/icerik.php?icerik=153', checkedAt: '2026-10-26' },
    });
    expect(y.ok).toBe(true);
    if (!y.ok) return;
    const anahtarlar = y.value.map((e) => e.key);
    expect(new Set(anahtarlar).size).toBe(anahtarlar.length);
    expect(y.value.map((e) => e.date)).toEqual([...y.value.map((e) => e.date)].sort());
    expect(y.value.some((e) => e.key === 'gib:1')).toBe(true);
    expect(y.value.find((e) => e.date === '2026-03-20')?.certainty).toBe('kesin');
    // Kurban 4. gün (30 Mayıs Cumartesi) ve 1 Haziran: Nisan primi 31 Mayıs Pazar → 1 Haziran Pazartesi
    expect(y.value.find((e) => e.period === 'Nisan 2026')?.date).toBe('2026-06-01');
  });

  it('kaynaksız yıl yalnız yasa ve kural tarihlerini içerir; GİB hatası yılı uygulamaz', () => {
    const y = buildYear(2027, {});
    expect(y.ok && y.value.some((e) => e.source === 'gib')).toBe(false);
    expect(y.ok && y.value.filter((e) => e.source === 'tatil')).toHaveLength(8);
    expect(buildYear(2026, { gib: anlik([gibKaydi(1, '2026-10-28')], { count: 5 }) })).toEqual({ ok: false, error: 'sayi_uyusmuyor' });
  });
});

describe('aynı güne denk gelen tatiller', () => {
  it('Kurban Bayramı 4. günü 19 Mayıs 2027\'ye denk gelir: iki tatil de takvimde kalır', () => {
    const y = buildYear(2027, { religious: { dates: { ramazan: '2027-03-10', kurban: '2027-05-16' }, certain: false, sourceUrl: 'https://date.nager.at', checkedAt: '2026-10-27' } });
    expect(y.ok).toBe(true);
    if (!y.ok) return;
    expect(y.value.filter((e) => e.date === '2027-05-19').map((e) => e.title).sort()).toEqual(['Atatürk’ü Anma, Gençlik ve Spor Bayramı', 'Kurban Bayramı 4. gün']);
    expect(holidayDates(y.value).has('2027-05-19')).toBe(true);
  });
});
