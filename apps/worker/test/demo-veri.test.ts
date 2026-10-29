import { describe, expect, it } from 'vitest';
import { parseTaxId } from '@eworks/kernel';
import { validateFirm, type Ctx, type Firm, type FirmDeps, type FirmRepository, type TaxpayerRegistry, type ValidFirm } from '@eworks/portfolio';
import { adTohumu, sahteTckn, sahteVkn, tohumluRastgele } from '../src/demo-rastgele.ts';
import { demoFirmalari, demoFirmalariniAc, main } from '../src/demo-veri.ts';

// Demo/geliştirme kipinde portalın boş ekran göstermemesi için sentetik veri üretilir.
// Gerçek kişi ya da firma verisi kullanılmaz: kimlikler sahte ama kontrol hanesi geçerlidir.

const ctx: Ctx = { sub: 'kullanici-1', org: 'ofis-1' };

/** Gerçek adaptörün sözleşmesini taklit eden bellek içi depo (mock kütüphanesi kullanılmaz). */
function depo(musavir: string | null = 'musavir-1') {
  const kayitlar = new Map<string, Firm>();
  const repo: FirmRepository = {
    list: async () => [...kayitlar.values()],
    get: async (_c, id) => kayitlar.get(id) ?? null,
    myAdvisor: async () => musavir,
    insert: async (_c, id, advisorId, f: ValidFirm) => {
      kayitlar.set(id, { ...f, id, advisorId, version: 1 } as unknown as Firm);
    },
    byTaxIds: async (_c, ids) => [...kayitlar.values()].filter((f) => ids.includes(f.taxId)),
    updateFromSource: async () => {},
    update: async () => 'ok',
    archive: async () => true,
    recordExport: async () => {},
  };
  return { repo, kayitlar };
}

/** VKN tekilliği: aynı özet ikinci kez rezerve edilemez (gerçek davranış). */
function kutuk() {
  const aktif = new Map<string, string>();
  const registry: TaxpayerRegistry = {
    reserve: async (hash, _org, firmId) => {
      if (aktif.has(hash) && aktif.get(hash) !== firmId) return 'taken';
      aktif.set(hash, firmId);
      return 'ok';
    },
    activate: async () => {},
    release: async (hash) => void aktif.delete(hash),
  };
  return { registry, aktif };
}

function bagimliliklar(musavir: string | null = 'musavir-1'): FirmDeps & { kayitlar: Map<string, Firm> } {
  const { repo, kayitlar } = depo(musavir);
  const { registry } = kutuk();
  let n = 0;
  return { repo, registry, hashTaxId: (t) => `h:${t}`, newId: () => `firma-${++n}`, kayitlar };
}

describe('sahte kimlikler', () => {
  it('üretilen VKN ve TCKN gerçek doğrulayıcıdan geçer', () => {
    const rnd = tohumluRastgele(42);
    for (let i = 0; i < 50; i++) {
      expect(parseTaxId(sahteVkn(rnd))).toEqual({ ok: true, value: { kind: 'VKN', value: expect.any(String) } });
      expect(parseTaxId(sahteTckn(rnd))).toEqual({ ok: true, value: { kind: 'TCKN', value: expect.any(String) } });
    }
  });

  it('TCKN 99 ile başlar: gerçek kişiyle çakışmaz ve sahte olduğu anlaşılır', () => {
    const rnd = tohumluRastgele(7);
    for (let i = 0; i < 20; i++) expect(sahteTckn(rnd).startsWith('99')).toBe(true);
  });

  it('aynı tohum aynı sonucu verir (tekrarlanabilir demo)', () => {
    expect(demoFirmalari(5, 6).map((f) => f.taxId)).toEqual(demoFirmalari(5, 6).map((f) => f.taxId));
  });
});

describe('demo firmaları', () => {
  it('hepsi alan doğrulamasından geçer', () => {
    for (const f of demoFirmalari(1, 12)) expect(validateFirm(f).ok, `${f.title} geçersiz`).toBe(true);
  });

  it('vergi kimlikleri benzersizdir', () => {
    const kimlikler = demoFirmalari(1, 12).map((f) => f.taxId);
    expect(new Set(kimlikler).size).toBe(kimlikler.length);
  });

  it('ekranların dolu görünmesi için tür ve durum çeşitliliği içerir', () => {
    const f = demoFirmalari(1, 12);
    expect(new Set(f.map((x) => x.kind)).size).toBeGreaterThanOrEqual(3);
    expect(new Set(f.map((x) => x.status)).size).toBeGreaterThanOrEqual(2);
    // Şahıs firmasında TCKN (11 hane), şirkette VKN (10 hane)
    expect(f.some((x) => x.taxId.length === 11)).toBe(true);
    expect(f.some((x) => x.taxId.length === 10)).toBe(true);
  });
});

describe('ofis başına tohum', () => {
  // VKN dizini (directory.taxpayer_registry) sistem genelinde tekildir: çakışma yalnız tax_id_hash üzerinde,
  // org_id dahil değil. Sabit tohum kullanılsaydı ikinci demo ofisine hiç mükellef açılamazdı.
  it('farklı ofis adı çakışmayan kimlikler üretir', () => {
    const a = demoFirmalari(adTohumu('Demo Mali Müşavirlik'), 12).map((f) => f.taxId);
    const b = demoFirmalari(adTohumu('Demo Ofis B'), 12).map((f) => f.taxId);
    expect(a.filter((x) => b.includes(x))).toEqual([]);
  });

  it('aynı ofis adı aynı tohumu verir (tekrar çalıştırılabilir)', () => {
    expect(adTohumu('Demo Ofis B')).toBe(adTohumu('Demo Ofis B'));
    expect(adTohumu('Demo Ofis B')).not.toBe(adTohumu('Demo Ofis C'));
  });
});

describe('demo firmalarını açma', () => {
  it('firmaları ofise ekler', async () => {
    const d = bagimliliklar();
    const sonuc = await demoFirmalariniAc(ctx, d, { adet: 8 });
    expect(sonuc).toEqual({ eklenen: 8, atlanan: 0, hatalar: [] });
    expect(d.kayitlar.size).toBe(8);
  });

  it('ikinci kez çalıştırmada yeni kayıt açmaz (tekrar çalıştırılabilir)', async () => {
    const d = bagimliliklar();
    await demoFirmalariniAc(ctx, d, { adet: 8 });
    const ikinci = await demoFirmalariniAc(ctx, d, { adet: 8 });
    // Zaten kayıtlı VKN beklenen durumdur: atlanan sayılır, hata değil
    expect(ikinci).toEqual({ eklenen: 0, atlanan: 8, hatalar: [] });
    expect(d.kayitlar.size).toBe(8);
  });

  it('ofiste müşavir yoksa bunu hata olarak bildirir, "zaten vardı" saymaz', async () => {
    const d = bagimliliklar(null);
    // Sessizce atlanırsa kurulum hatası başarı gibi görünür ve ekranlar boş açılır
    expect(await demoFirmalariniAc(ctx, d, { adet: 3 })).toEqual({ eklenen: 0, atlanan: 0, hatalar: ['musavir_yok', 'musavir_yok', 'musavir_yok'] });
  });
});

describe('kip koruması', () => {
  // Hakan (29.10, 13:01): sahte veri yalnız demo kipinde. Görev elle de çalıştırılabildiği için kural
  // yalnız yigin.mjs'de değil, görevin kendisinde de denetlenir (veritabanına hiç dokunmadan).
  it('demo dışı bir kipte hiçbir şey yazmadan durur', async () => {
    for (const kip of ['gelistirme', 'debug', 'uretim']) {
      await expect(main({ YIGIN_KIPI: kip }), kip).rejects.toThrow(/yalnız demo kipinde/);
    }
  });
});
