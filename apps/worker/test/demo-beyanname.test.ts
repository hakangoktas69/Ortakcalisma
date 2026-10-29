import { describe, expect, it } from 'vitest';
import { checkFilings, type FilingRepository, type SgkFilingRecord, type StoredFiling } from '@eworks/social-security';
import { checkQuery, groupContracts, istanbulDay, type ContractList, type ContractRepository, type Ctx, type DocumentPort, type FirmPort, type StoredDeclaration } from '@eworks/tax-filing';
import type { DeclarationRepository } from '@eworks/tax-filing';
import { demoBeyannameleriAc, demoSorgular, demoSozlesmeListesi, type DemoFirma } from '../src/demo-beyanname.ts';

// Beyanname, SGK ve GİB sözleşmesi ekranları demo/geliştirme kipinde boş kalmasın diye sentetik kayıt üretilir.
// Üretilen veri gerçek içe aktarma yolundan geçer: sözleşme listesi ve sorgular kurumdan gelmiş gibi doğrulanır.

const ctx: Ctx = { org: 'ofis-1' }; // sistem bağlamı: bu kayıtları yalnız işçi yazar
const BUGUN = new Date('2026-10-29T00:00:00Z');

const firmalar: DemoFirma[] = [
  { id: 'firma-1', taxId: '4970337300', title: 'Çınar Tekstil Ltd. Şti.', taxOffice: 'Gazi Vergi Dairesi' },
  { id: 'firma-2', taxId: '99674843808', title: 'Deniz Güneş', taxOffice: 'İlkadım Vergi Dairesi' },
  { id: 'firma-3', taxId: '6030000083', title: 'Ege Lojistik A.Ş.', taxOffice: null },
];

describe('demo sözleşme listesi', () => {
  it('gerçek liste doğrulamasından geçer ve mükellef başına gruplanır', () => {
    const liste = demoSozlesmeListesi(firmalar, 1);
    const g = groupContracts(liste);
    expect(g.ok).toBe(true);
    if (g.ok) expect(g.groups.map((x) => x.taxId).sort()).toEqual(firmalar.map((f) => f.taxId).sort());
  });

  it('VKN 10 hanede vergi numarası, TCKN 11 hanede kimlik numarası alanına yazılır', () => {
    const satirlar = demoSozlesmeListesi(firmalar, 1).contracts;
    const vkn = satirlar.find((c) => c.taxNumber === '4970337300');
    const tckn = satirlar.find((c) => c.identityNumber === '99674843808');
    expect(vkn?.identityNumber).toBe('');
    expect(tckn?.taxNumber).toBe('');
  });
});

describe('demo beyanname sorguları', () => {
  const liste = demoSozlesmeListesi(firmalar, 1);

  it('her sorgu erişim kanıtı denetiminden geçer (sessizce atlanmaz)', () => {
    for (const q of demoSorgular(firmalar, liste, 1, BUGUN)) {
      const r = checkQuery(q, liste.contracts);
      expect(r.ok, `${q.identity}: ${r.ok ? '' : r.reason}`).toBe(true);
    }
  });

  it('yükleme tarihi sorgu kapsamında ve gelecekte değil', () => {
    const bugun = BUGUN.toISOString().slice(0, 10);
    for (const q of demoSorgular(firmalar, liste, 1, BUGUN)) {
      for (const r of q.records) {
        const gun = istanbulDay(r.uploadedAt);
        expect(gun).not.toBeNull();
        expect((gun as string) >= q.startDate, `${gun} < ${q.startDate}`).toBe(true);
        expect((gun as string) <= bugun, `${gun} gelecekte`).toBe(true);
      }
    }
  });

  it('MUHSGK satırları gerçek SGK doğrulamasından geçer', () => {
    let muhsgk = 0;
    for (const q of demoSorgular(firmalar, liste, 1, BUGUN)) {
      for (const r of q.records.filter((x) => x.type === 'MUHSGK')) {
        muhsgk++;
        expect(checkFilings(r.sgk as SgkFilingRecord[], r)).toBe(true);
      }
    }
    expect(muhsgk).toBeGreaterThan(0);
  });

  it('ekranların dolu görünmesi için birden çok beyanname türü üretilir', () => {
    const turler = new Set(demoSorgular(firmalar, liste, 1, BUGUN).flatMap((q) => q.records.map((r) => r.type)));
    expect(turler.size).toBeGreaterThanOrEqual(2);
  });

  it('aynı tohum aynı sonucu verir', () => {
    expect(demoSorgular(firmalar, liste, 5, BUGUN)).toEqual(demoSorgular(firmalar, demoSozlesmeListesi(firmalar, 5), 5, BUGUN));
  });
});

/** Bellek içi sahteler: gerçek adaptörlerin sözleşmesini taklit eder (mock kütüphanesi yok). */
function bagimliliklar() {
  const sozlesmeler = new Map<string, number>();
  const beyannameler = new Map<string, StoredDeclaration>();
  const sgkKayitlari = new Map<string, StoredFiling>();
  const firms: FirmPort = {
    byTaxIds: async (_c, ids) => firmalar.filter((f) => ids.includes(f.taxId)).map((f) => ({ id: f.id, taxId: f.taxId, title: f.title, taxOffice: f.taxOffice, source: 'manual' as const })),
    create: async () => ({ ok: false, error: 'vkn_kayitli' as const }),
    refresh: async () => false,
  };
  const contracts: ContractRepository = {
    upsert: async (_c, firmId, rows) => void sozlesmeler.set(firmId, rows.length),
    list: async () => [],
  };
  const declarations: DeclarationRepository = {
    upsert: async (_c, firmId, r) => {
      const id = `${firmId}|${r.recordId}`;
      const created = !beyannameler.has(id);
      beyannameler.set(id, { id, firmId } as StoredDeclaration);
      return { id, created };
    },
    list: async () => [],
    get: async () => null,
    types: async () => [],
  };
  const filings: FilingRepository = {
    upsert: async (_c, firmId, declarationId, r) => {
      const id = `${firmId}|${declarationId}|${r.recordId}`;
      sgkKayitlari.set(id, { id } as StoredFiling);
      return { id };
    },
    list: async () => [],
    get: async () => null,
  };
  const documents: DocumentPort = { register: async () => 0 };
  return { d: { firms, contracts, declarations, filings, documents }, sozlesmeler, beyannameler, sgkKayitlari };
}

describe('demo beyannamelerini açma', () => {
  it('sözleşme, beyanname ve SGK bildirimi yazar', async () => {
    const b = bagimliliklar();
    const sonuc = await demoBeyannameleriAc(ctx, firmalar, b.d, { tohum: 1, bugun: BUGUN, advisorId: 'musavir-1' });
    expect(sonuc.hatalar).toEqual([]);
    expect(sonuc.sozlesme).toBe(firmalar.length);
    expect(sonuc.beyanname).toBeGreaterThan(0);
    expect(sonuc.sgk).toBeGreaterThan(0);
    expect(b.beyannameler.size).toBe(sonuc.beyanname);
  });

  it('ikinci kez çalıştırmada yeni kayıt açmaz (tekrar çalıştırılabilir)', async () => {
    const b = bagimliliklar();
    const ilk = await demoBeyannameleriAc(ctx, firmalar, b.d, { tohum: 1, bugun: BUGUN, advisorId: 'musavir-1' });
    const boyut = b.beyannameler.size;
    const ikinci = await demoBeyannameleriAc(ctx, firmalar, b.d, { tohum: 1, bugun: BUGUN, advisorId: 'musavir-1' });
    expect(ikinci.yeni).toBe(0);
    expect(ilk.yeni).toBeGreaterThan(0);
    expect(b.beyannameler.size).toBe(boyut);
  });

  it('doğrulanamayan sorgu sessizce sayılmaz, hata olarak bildirilir', async () => {
    const b = bagimliliklar();
    // Erişim kanıtı bozuk üreteç: importDeclarations bunu "erişim yok" diye sayar ve sessizce geçerdi
    const bozuk = (f: readonly DemoFirma[], l: ContractList, t: number, g: Date) =>
      demoSorgular(f, l, t, g).map((q) => ({ ...q, access: { method: 'same_session_contract' as const, contractNumbers: ['YOK-123'] } }));
    const sonuc = await demoBeyannameleriAc(ctx, firmalar, b.d, { tohum: 1, bugun: BUGUN, advisorId: 'musavir-1', sorguUreteci: bozuk });
    expect(sonuc.hatalar.length).toBeGreaterThan(0);
    expect(sonuc.beyanname).toBe(0);
  });

  it('firma yoksa hiçbir şey yazmaz', async () => {
    const b = bagimliliklar();
    const sonuc = await demoBeyannameleriAc(ctx, [], b.d, { tohum: 1, bugun: BUGUN, advisorId: 'musavir-1' });
    expect(sonuc).toEqual({ sozlesme: 0, beyanname: 0, yeni: 0, sgk: 0, belge: 0, hatalar: [] });
  });
});
