import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { storageKey, validDocument } from '@eworks/documents';
import { checkQuery, type ContractList, type DeclarationQuery } from '@eworks/tax-filing';
import { belgeleriEkle, demoPdf, type BelgeDepo } from '../src/demo-belge.ts';
import { demoSorgular, demoSozlesmeListesi, type DemoFirma } from '../src/demo-beyanname.ts';

// /beyanname/belge ekranı demo kipinde boş kalmasın diye gerçek PDF üretilir ve demo S3'e konur.
// Uydurma bir belge satırı indirilemez olurdu; bu yüzden dosya gerçekten yazılır, özet ve boyut dosyadan hesaplanır.

const ORG = '00000000-0000-4000-8000-000000000001';
const BUGUN = new Date('2026-10-29T00:00:00Z');

const firmalar: DemoFirma[] = [
  { id: 'firma-1', taxId: '4970337300', title: 'Çınar Tekstil Ltd. Şti.', taxOffice: 'Gazi Vergi Dairesi' },
  { id: 'firma-2', taxId: '99674843808', title: 'Deniz Güneş', taxOffice: 'İlkadım Vergi Dairesi' },
];

/** Bellek içi belge deposu: gerçek Depo.koy sözleşmesini taklit eder. */
function depo() {
  const nesneler = new Map<string, { govde: Buffer; tur: string }>();
  const d: BelgeDepo = { koy: async (anahtar, govde, tur) => void nesneler.set(anahtar, { govde, tur }) };
  return { d, nesneler };
}

describe('demo PDF', () => {
  const pdf = demoPdf('Beyanname', ['KDV1', '09/2026', 'DEMO - gercek belge degildir']);

  it('gerçek bir PDF dosyasıdır', () => {
    expect(pdf.subarray(0, 5).toString('latin1')).toBe('%PDF-');
    expect(pdf.subarray(-6).toString('latin1').trim()).toBe('%%EOF');
    // xref tablosu ve kök nesne olmadan tarayıcı açamaz
    const metin = pdf.toString('latin1');
    expect(metin).toContain('/Type /Catalog');
    expect(metin).toContain('xref');
    expect(metin).toContain('startxref');
  });

  it('xref tablosundaki bayt konumları nesnelerin gerçek yerini gösterir', () => {
    // PDF okuyucusu dosyayı sondan başlar: startxref → xref tablosu → nesne konumları.
    // Konumlar bir bayt bile kayarsa katı okuyucular dosyayı açamaz.
    const metin = pdf.toString('latin1');
    const basla = Number(/startxref\s+(\d+)/.exec(metin)?.[1]);
    expect(Number.isInteger(basla)).toBe(true);
    expect(metin.slice(basla, basla + 4)).toBe('xref');
    const tablo = metin.slice(basla);
    const adet = Number(/^xref\s+0 (\d+)/.exec(tablo)?.[1]);
    const girdiler = [...tablo.matchAll(/^(\d{10}) 00000 n $/gm)].map((m) => Number(m[1]));
    expect(girdiler).toHaveLength(adet - 1); // 0 numaralı girdi serbest (f)
    girdiler.forEach((konum, i) => {
      expect(metin.slice(konum, konum + `${i + 1} 0 obj`.length), `${i + 1}. nesnenin konumu yanlış`).toBe(`${i + 1} 0 obj`);
    });
  });

  it('akış uzunluğu gerçek içerik uzunluğudur', () => {
    const metin = pdf.toString('latin1');
    const bildirilen = Number(/\/Length (\d+) >>\s*stream/.exec(metin)?.[1]);
    const akis = /stream\n([\s\S]*?)\nendstream/.exec(metin)?.[1] ?? '';
    expect(Buffer.byteLength(akis, 'latin1')).toBe(bildirilen);
  });

  it('belge boyut kuralını karşılar (en az 100 bayt)', () => {
    expect(pdf.length).toBeGreaterThanOrEqual(100);
  });

  it('aynı girdi aynı dosyayı verir (tekrar çalıştırmada özet değişmez)', () => {
    expect(demoPdf('Beyanname', ['KDV1', '09/2026', 'DEMO - gercek belge degildir'])).toEqual(pdf);
  });

  it('içeriğinde demo olduğu yazar', () => {
    expect(pdf.toString('latin1')).toContain('DEMO');
  });
});

describe('belgeleri ekleme', () => {
  const liste: ContractList = demoSozlesmeListesi(firmalar, 1);

  it('her beyannameye belge ekler ve dosyayı depoya yazar', async () => {
    const dp = depo();
    const sorgular = await belgeleriEkle(ORG, demoSorgular(firmalar, liste, 1, BUGUN), dp.d);
    const belgeler = sorgular.flatMap((q) => q.records.flatMap((r) => r.documents));
    expect(belgeler.length).toBeGreaterThan(0);
    expect(dp.nesneler.size).toBeGreaterThan(0);
    for (const b of belgeler) {
      expect(dp.nesneler.has(b.key), `${b.key} depoya yazılmadı`).toBe(true);
      expect(dp.nesneler.get(b.key)?.tur).toBe('application/pdf');
    }
  });

  it('belge tanımı gerçek doğrulayıcıdan geçer (anahtar = org + özet)', async () => {
    const sorgular = await belgeleriEkle(ORG, demoSorgular(firmalar, liste, 1, BUGUN), depo().d);
    for (const r of sorgular.flatMap((q) => q.records)) {
      for (const b of r.documents) {
        expect(validDocument(ORG, b), `${b.kind} geçersiz`).toBe(true);
        expect(b.key).toBe(storageKey(ORG, b.sha256));
      }
    }
  });

  it('özet ve boyut gerçekten yazılan dosyadan hesaplanır', async () => {
    const dp = depo();
    const sorgular = await belgeleriEkle(ORG, demoSorgular(firmalar, liste, 1, BUGUN), dp.d);
    for (const b of sorgular.flatMap((q) => q.records).flatMap((r) => r.documents)) {
      const dosya = dp.nesneler.get(b.key)?.govde as Buffer;
      expect(createHash('sha256').update(dosya).digest('hex')).toBe(b.sha256);
      expect(dosya.length).toBe(b.size);
    }
  });

  it('MUHSGK satırlarına SGK belgeleri eklenir', async () => {
    const sorgular = await belgeleriEkle(ORG, demoSorgular(firmalar, liste, 1, BUGUN), depo().d);
    const sgkBelgeleri = sorgular
      .flatMap((q) => q.records)
      .filter((r) => r.type === 'MUHSGK')
      .flatMap((r) => (r.sgk as { documents: { kind: string }[] }[]) ?? [])
      .flatMap((s) => s.documents);
    expect(sgkBelgeleri.length).toBeGreaterThan(0);
    expect(new Set(sgkBelgeleri.map((b) => b.kind))).toEqual(new Set(['sgk_accrual', 'sgk_service']));
  });

  it('belge eklendikten sonra sorgular hâlâ erişim denetiminden geçer', async () => {
    const sorgular = await belgeleriEkle(ORG, demoSorgular(firmalar, liste, 1, BUGUN), depo().d);
    for (const q of sorgular as DeclarationQuery[]) expect(checkQuery(q, liste.contracts).ok).toBe(true);
  });

  it('aynı belge iki kez yazılmaz (aynı içerik aynı anahtar)', async () => {
    const dp = depo();
    await belgeleriEkle(ORG, demoSorgular(firmalar, liste, 1, BUGUN), dp.d);
    const ilk = dp.nesneler.size;
    await belgeleriEkle(ORG, demoSorgular(firmalar, liste, 1, BUGUN), dp.d);
    expect(dp.nesneler.size).toBe(ilk);
  });
});
