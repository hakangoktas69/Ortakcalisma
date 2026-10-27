import { describe, expect, it } from 'vitest';
import { eksikleriTamamla, takvimHazirla, takvimYillari } from '../src/takvim.ts';

// İşçinin takvim döngüsü: her ofis için yılın takvimi hazır kaynaktan doldurulur; Ekim'den sonra gelecek yıl da hazırlanır.
describe('takvim hazırlama', () => {
  it('bulunulan yıl; Ekim ve sonrasında gelecek yıl da (İstanbul saatine göre)', () => {
    expect(takvimYillari(new Date('2026-03-15T09:00:00Z'))).toEqual([2026]);
    expect(takvimYillari(new Date('2026-10-01T00:30:00Z'))).toEqual([2026, 2027]);
    // 31 Aralık 22:30 UTC İstanbul'da 1 Ocak'tır
    expect(takvimYillari(new Date('2026-12-31T22:30:00Z'))).toEqual([2027]);
  });

  it('[F:genel_bakis.takvim.view] her ofis ve yıl için hazırlar; GİB verisi eksik olanları ve hataları ayrı sayar, bir ofisin hatası diğerlerini durdurmaz', async () => {
    const cagrilar: string[] = [];
    const sonuc = await takvimHazirla(['o1', 'o2', 'o3'], [2026, 2027], async (org, yil) => {
      cagrilar.push(`${org}:${yil}`);
      if (org === 'o2') throw new Error('veritabanı');
      return { ok: true, value: { written: yil === 2027 ? 30 : 0, needsGib: yil === 2027 } };
    });
    expect(cagrilar).toEqual(['o1:2026', 'o1:2027', 'o2:2026', 'o3:2026', 'o3:2027']);
    expect(sonuc).toEqual({ yazilan: 60, gibEksik: [{ org: 'o1', yil: 2027 }, { org: 'o3', yil: 2027 }], hata: 1 });
  });

  it('kaynak doğrulanamazsa (fail-closed) yazılmaz ve hata sayılır', async () => {
    const sonuc = await takvimHazirla(['o1'], [2026], async () => ({ ok: false, error: 'sayi_uyusmuyor' }));
    expect(sonuc).toEqual({ yazilan: 0, gibEksik: [], hata: 1 });
  });
});

describe('ortak takvim kaynağı (kamuya açık veri bir kez çekilir, ofislere kopyalanır)', () => {
  const gib = { schema: 'eworks.gib.tax-calendar.v1', year: 2027, checkedAt: '2026-10-27', sourceUrl: 'https://gib.gov.tr/vergi-takvimi', count: 0, records: [] };
  const ortak = (o: Record<string, unknown> = {}) => ({ year: 2027, observedAt: '2026-10-27T10:00:00Z', gib, religious: null, ...o });
  const kur = (kayit: Record<number, unknown>) => {
    const uygulanan: string[] = [];
    const istenen: string[] = [];
    return {
      uygulanan,
      istenen,
      d: {
        ortakOku: async (yil: number) => (kayit[yil] ?? null) as never,
        uygula: async (org: string, yil: number) => void uygulanan.push(`${org}:${yil}`),
        iste: async (org: string, yil: number) => void istenen.push(`${org}:${yil}`),
        bellek: new Map<number, Set<string>>(),
      },
    };
  };

  it('[F:genel_bakis.takvim.sync] taze ortak sonuç varsa eksik ofisler kuruma gitmeden doldurulur', async () => {
    const k = kur({ 2027: ortak() });
    const r = await eksikleriTamamla([{ org: 'o1', yil: 2027 }, { org: 'o2', yil: 2027 }], new Date('2026-10-28T10:00:00Z'), k.d);
    expect(r).toEqual({ uygulanan: 2, istenen: 0 });
    expect(k.uygulanan).toEqual(['o1:2027', 'o2:2027']);
    expect(k.istenen).toEqual([]);
  });

  it('ortak sonuç yoksa ya da 7 günden eskiyse yıl başına yalnız bir ofis için iş istenir', async () => {
    const yok = kur({});
    expect(await eksikleriTamamla([{ org: 'o1', yil: 2027 }, { org: 'o2', yil: 2027 }, { org: 'o3', yil: 2028 }], new Date(), yok.d)).toEqual({ uygulanan: 0, istenen: 2 });
    expect(yok.istenen).toEqual(['o1:2027', 'o3:2028']);
    const eski = kur({ 2027: ortak({ observedAt: '2026-10-01T10:00:00Z' }) });
    expect(await eksikleriTamamla([{ org: 'o1', yil: 2027 }], new Date('2026-10-28T10:00:00Z'), eski.d)).toEqual({ uygulanan: 0, istenen: 1 });
  });

  it('GİB henüz yayımlamadıysa (taze sonuçta GİB yok) iş istenmez; yalnız bayramlar her ofise bir kez uygulanır', async () => {
    const religious = { ramazan: '2027-03-10', kurban: '2027-05-16', certain: false, sourceUrl: 'https://date.nager.at', checkedAt: '2026-10-27' };
    const k = kur({ 2027: ortak({ gib: null, religious }) });
    const simdi = new Date('2026-10-28T10:00:00Z');
    expect(await eksikleriTamamla([{ org: 'o1', yil: 2027 }], simdi, k.d)).toEqual({ uygulanan: 1, istenen: 0 });
    expect(await eksikleriTamamla([{ org: 'o1', yil: 2027 }], simdi, k.d)).toEqual({ uygulanan: 0, istenen: 0 });
    const bos = kur({ 2027: ortak({ gib: null, religious: null }) });
    expect(await eksikleriTamamla([{ org: 'o1', yil: 2027 }], simdi, bos.d)).toEqual({ uygulanan: 0, istenen: 0 });
  });

  it('bir ofisin uygulama hatası diğerlerini durdurmaz', async () => {
    const k = kur({ 2027: ortak() });
    k.d.uygula = async (org: string) => {
      if (org === 'o1') throw new Error('veritabanı');
      k.uygulanan.push(org);
    };
    expect(await eksikleriTamamla([{ org: 'o1', yil: 2027 }, { org: 'o2', yil: 2027 }], new Date('2026-10-28T10:00:00Z'), k.d)).toEqual({ uygulanan: 1, istenen: 0 });
  });
});
