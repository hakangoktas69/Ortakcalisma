import { describe, expect, it } from 'vitest';
import type { CredentialRepository } from '@eworks/credentials';
import type { Firm, FirmRepository } from '@eworks/portfolio';
import type { Job, JobRepository } from '@eworks/sync';
import type { DocumentRepository } from '@eworks/documents';
import type { ContractRepository, DeclarationRepository } from '@eworks/tax-filing';
import { fakeVkn, seededRandom } from '@eworks/testing';
import { sonucuIsle, type UygulayiciDeps } from '../src/uygulayici.ts';

const ORG = '11111111-1111-4111-8111-111111111111';
const JOB = '22222222-2222-4222-8222-222222222222';
const rnd = seededRandom(5);

function kur(opts: { ownerKind?: 'advisor' | 'firm'; status?: Job['status']; kind?: Job['kind'] } = {}) {
  const is: Job = { id: JOB, kind: opts.kind ?? 'gib.sozlesmeler', accountId: 'h-1', status: opts.status ?? 'running', statusMessage: null, resultSummary: null, createdAt: '', startedAt: null, finishedAt: null };
  const girisler: string[] = [];
  const firmalar = new Map<string, Firm>();
  const yazilan: number[] = [];
  const nesneler = new Map<string, unknown>();
  const beyannameler: string[] = [];
  const belgeler: string[] = [];
  const silinen: string[] = [];
  const jobs: JobRepository = {
    activeFor: async () => null,
    insertWithOutbox: async () => {},
    get: async () => is,
    latest: async () => [is],
    setStatus: async (_c, _id, from, to, m, s) => {
      if (!from.includes(is.status)) return false;
      Object.assign(is, { status: to, statusMessage: m, resultSummary: s ?? null });
      return true;
    },
    setMessage: async (_c, _id, m) => void (is.statusMessage = m),
    accountOwner: async () => ({ accountId: 'h-1', ownerKind: opts.ownerKind ?? 'advisor', ownerId: 'm-1' }),
    staleRunning: async () => [],
  };
  const creds: CredentialRepository = { save: async () => ({ ok: true, value: { accountId: 'h-1' } }), statuses: async () => [], recordLogin: async (_c, _id, o) => void girisler.push(o) };
  const repo = {
    byTaxIds: async (_c: unknown, ids: readonly string[]) => [...firmalar.values()].filter((f) => ids.includes(f.taxId)),
    insert: async (_c: unknown, id: string, advisorId: string, f: Omit<Firm, 'id'>) => void firmalar.set(id, { ...f, id, advisorId, source: 'gib_contract', archivedAt: null, version: 1 } as Firm),
    updateFromSource: async () => {},
  } as unknown as FirmRepository;
  let n = 0;
  const sozlesmeler: ContractRepository = { upsert: async (_c, _f, rows) => void yazilan.push(rows.length), list: async () => [] };
  const d: UygulayiciDeps = {
    jobs,
    creds,
    firmalar: { repo, registry: { reserve: async () => 'ok', activate: async () => {}, release: async () => {} }, hashTaxId: (t) => t, newId: () => `f-${++n}` },
    sozlesmeler,
    beyannameler: {
      upsert: async (_c, _f, r) => {
        beyannameler.push(r.recordId);
        return { id: `b-${r.recordId}`, created: true };
      },
      list: async () => [],
      get: async () => null,
      types: async () => [],
    } as DeclarationRepository,
    belgeler: { upsert: async (_c: unknown, x: { key: string }) => void belgeler.push(x.key) } as unknown as DocumentRepository,
    sonucOku: async (k) => nesneler.get(k),
    sgk: { upsert: async () => ({ id: 's' }), list: async () => [], get: async () => null },
    sonucSil: async (k) => void silinen.push(k),
  };
  return { d, is, girisler, firmalar, yazilan, nesneler, beyannameler, belgeler, silinen };
}

const liste = (adet: number) => ({
  schema: 'eworks.gib.contracts.v1',
  jobId: JOB,
  sourceType: 'sahte_gib',
  observedAt: '2026-10-25T10:00:00Z',
  count: adet,
  contracts: Array.from({ length: adet }, (_, i) => ({
    taxNumber: fakeVkn(rnd),
    identityNumber: '',
    name: `Örnek Ticaret ${i} Ltd. Şti.`,
    taxOffice: 'Kadıköy',
    number: `S-${i}`,
    date: '01.01.2026',
    service: 'E-Beyanname',
    registeredAt: '01.01.2026',
    type: 'Aracılık ve Sorumluluk Sözleşmesi',
  })),
});

const anahtar = `org/${ORG}/sonuc/${JOB}.json`;

describe('entegrasyon sonucu uygulayıcı', () => {
  it('başarılı liste: firmalar açılır, sözleşmeler yazılır, iş özetle tamamlanır ve demo kaynağı belirtilir', async () => {
    const k = kur();
    k.nesneler.set(anahtar, liste(3));
    expect(await sonucuIsle({ orgId: ORG, jobId: JOB, outcome: 'ok', resultKey: anahtar }, k.d)).toBe('uygulandi');
    expect(k.is.status).toBe('succeeded');
    expect(k.is.statusMessage).toContain('3 sözleşme · 3 mükellef · 3 yeni');
    expect(k.is.statusMessage).toContain('sahte GİB');
    expect(k.firmalar.size).toBe(3);
    expect(k.girisler).toEqual(['ok']);
  });

  it('hatalı şifre: hesap işaretlenir, iş "hatalı şifre" ile biter; ikinci kez gelen sonuç etkisizdir', async () => {
    const k = kur();
    expect(await sonucuIsle({ orgId: ORG, jobId: JOB, outcome: 'wrong_password' }, k.d)).toBe('hatali_sifre');
    expect(k.girisler).toEqual(['wrong_password']);
    expect(k.is.status).toBe('wrong_password');
    k.nesneler.set(anahtar, liste(1));
    await sonucuIsle({ orgId: ORG, jobId: JOB, outcome: 'ok', resultKey: anahtar }, k.d);
    expect(k.is.status).toBe('wrong_password');
  });

  it('şemaya uymayan mesaj ya da başka ofisin sonuç anahtarı reddedilir', async () => {
    const k = kur();
    await expect(sonucuIsle({ orgId: ORG, jobId: JOB, outcome: 'bilinmez' }, k.d)).rejects.toThrow('şemaya');
    await expect(sonucuIsle({ orgId: ORG, jobId: JOB, outcome: 'ok', resultKey: `org/${JOB}/sonuc/${JOB}.json` }, k.d)).rejects.toThrow();
    expect(k.is.status).toBe('running');
  });

  it('sözleşme şemasına uymayan ya da sayısı tutmayan sonuç hiç yazılmaz', async () => {
    const k = kur();
    k.nesneler.set(anahtar, { ...liste(2), fazla: 'alan' });
    expect(await sonucuIsle({ orgId: ORG, jobId: JOB, outcome: 'ok', resultKey: anahtar }, k.d)).toBe('gecersiz_sonuc');
    expect(k.is.status).toBe('failed');
    const k2 = kur();
    k2.nesneler.set(anahtar, { ...liste(2), count: 3 });
    expect(await sonucuIsle({ orgId: ORG, jobId: JOB, outcome: 'ok', resultKey: anahtar }, k2.d)).toBe('liste_hatasi');
    expect(k2.is.statusMessage).toContain('uyuşmadı');
    expect([...k.yazilan, ...k2.yazilan]).toEqual([]);
    expect(k2.firmalar.size).toBe(0);
  });

  it('ilerleme mesajı işi sonuçlandırmaz', async () => {
    const k = kur();
    expect(await sonucuIsle({ orgId: ORG, jobId: JOB, outcome: 'progress', message: 'Giriş yapılıyor.' }, k.d)).toBe('ilerleme');
    expect(k.is).toMatchObject({ status: 'running', statusMessage: 'Giriş yapılıyor.' });
  });
  it('[F:beyanname.senkron.start] beyanname sonucu: aynı oturumun sözleşmeleri uygulanır, yalnız Aracılık ve Sorumluluk kanıtlı sorgular yazılır, ham sonuç silinir', async () => {
    const k = kur({ kind: 'gib.beyannameler' });
    const l = liste(2);
    const [a, b] = l.contracts;
    const sha = 'a'.repeat(64);
    const kayit = (id: string) => ({ recordId: id, type: 'KDV1', periodStart: '2026-08', periodEnd: '2026-08', uploadedAt: '2026-09-20T10:00:00+03:00',
      taxStatus: 'Onaylandı', sgkStatus: '', branch: '0', reference: `${a!.taxNumber}_KDV1.xml`, referenceType: 'source_filename', documentWarnings: [],
      documents: [{ kind: 'declaration', key: `org/${ORG}/belgeler/${sha}.pdf`, sha256: sha, size: 1000 }] });
    k.nesneler.set(anahtar, {
      schema: 'eworks.gib.declarations.v1', jobId: JOB, sourceType: 'sahte_gib', observedAt: '2026-10-25T10:00:00Z',
      contracts: { count: l.count, contracts: l.contracts }, scope: { startDate: '2026-09-01', endDate: '2026-09-30' },
      queries: [
        { identity: a!.taxNumber, startDate: '2026-09-01', endDate: '2026-09-30', outcome: 'ok', access: { method: 'same_session_contract', contractNumbers: [a!.number] }, records: [kayit('r1')] },
        // Kanıttaki sözleşme numarası listede bu mükellefin değil → yazılmaz
        { identity: b!.taxNumber, startDate: '2026-09-01', endDate: '2026-09-30', outcome: 'ok', access: { method: 'same_session_contract', contractNumbers: [a!.number] }, records: [kayit('r2')] },
        { identity: b!.taxNumber, startDate: '2026-08-01', endDate: '2026-08-31', outcome: 'empty', access: { method: 'same_session_contract', contractNumbers: [b!.number] }, records: [] },
      ],
    });
    expect(await sonucuIsle({ orgId: ORG, jobId: JOB, outcome: 'ok', resultKey: anahtar }, k.d)).toBe('uygulandi');
    expect(k.beyannameler).toEqual(['r1']);
    expect(k.belgeler).toHaveLength(1);
    expect(k.firmalar.size).toBe(2);
    expect(k.is.status).toBe('succeeded');
    expect(k.is.statusMessage).toContain('3 sorgu · 1 beyanname (1 yeni) · 1 belge');
    expect(k.is.statusMessage).toContain('1 mükellefte Aracılık ve Sorumluluk sözleşmesi yok');
    expect(k.silinen).toEqual([anahtar]);
  });

  it('[F:sgk.ebildirge.sync] MUHSGK sonucu: SGK bildirimleri ve belgeleri social-security ve documents bağlamlarına yazılır', async () => {
    const k = kur({ kind: 'gib.muhsgk' });
    const sgkYazilan: string[] = [];
    k.d.sgk = { upsert: async (_c, _f, _b, r) => (sgkYazilan.push(r.recordId), { id: `s-${r.recordId}` }), list: async () => [], get: async () => null };
    const l = liste(1);
    const [a] = l.contracts;
    const sha = 'c'.repeat(64);
    k.nesneler.set(anahtar, {
      schema: 'eworks.gib.declarations.v1', jobId: JOB, sourceType: 'sahte_gib', observedAt: '2026-10-25T10:00:00Z',
      contracts: { count: l.count, contracts: l.contracts }, scope: { startDate: '2026-09-01', endDate: '2026-09-30' },
      queries: [{
        identity: a!.taxNumber, startDate: '2026-09-01', endDate: '2026-09-30', outcome: 'ok', access: { method: 'same_session_contract', contractNumbers: [a!.number] },
        records: [{ recordId: 'm1', type: 'MUHSGK', periodStart: '2026-08', periodEnd: '2026-08', uploadedAt: '2026-09-20T10:00:00+03:00', taxStatus: 'Onaylandı',
          sgkStatus: 'Onaylandı', branch: '0', reference: `${a!.taxNumber}_MUHSGK.xml`, referenceType: 'source_filename', documents: [], documentWarnings: [],
          sgk: [{ recordId: 'sg1', workplace: '1'.repeat(26), period: '2026-08', status: 'Onaylandı', employeeCount: 7, documentWarnings: [],
            documents: [{ kind: 'sgk_service', key: `org/${ORG}/belgeler/${sha}.pdf`, sha256: sha, size: 900 }] }] }],
      }],
    });
    expect(await sonucuIsle({ orgId: ORG, jobId: JOB, outcome: 'ok', resultKey: anahtar }, k.d)).toBe('uygulandi');
    expect(sgkYazilan).toEqual(['sg1']);
    expect(k.belgeler).toEqual([`org/${ORG}/belgeler/${sha}.pdf`]);
    expect(k.is.statusMessage).toContain('1 SGK bildirimi (1 belge)');
  });
});
