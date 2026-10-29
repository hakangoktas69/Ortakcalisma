import { describe, expect, it } from 'vitest';
import { CONSENT_METHODS, validateCredential, type AccountStatus, type Consent, type ConsentRepository, type CredentialRepository } from '@eworks/credentials';
import { DONE, taskCounters, validateTask, validNote, type Ctx, type MemberPort, type Note, type NoteRepository, type Task, type TaskRepository } from '@eworks/workspace';
import { demoGorevleri, demoKurumHesaplariniAc, demoNotlari, demoGorevleriAc, demoNotlariAc, type DemoFirma } from '../src/demo-calisma.ts';

// Görev, not, kurum hesabı ve mükellef onayı ekranları demo/geliştirme kipinde boş kalmasın diye sentetik kayıt üretilir.
// Kurum şifreleri sahtedir ve yalnız Vault'a gider; demo dışında hiçbir koşulda oluşmaz.

const ctx: Ctx = { sub: 'kullanici-1', org: 'ofis-1' };
const BUGUN = new Date('2026-10-29T00:00:00Z');
const BUGUN_GUN = '2026-10-29';
const hepsineIzin = () => true;

const firmalar: DemoFirma[] = [
  { id: 'firma-1', title: 'Çınar Tekstil Ltd. Şti.' },
  { id: 'firma-2', title: 'Deniz Güneş' },
  { id: 'firma-3', title: 'Ege Lojistik A.Ş.' },
  { id: 'firma-4', title: 'Lale Gıda Ltd. Şti.' },
];

function gorevDeposu() {
  const kayitlar = new Map<string, Task>();
  let n = 0;
  const tasks: TaskRepository = {
    list: async () => [...kayitlar.values()],
    get: async (_c, id) => kayitlar.get(id) ?? null,
    insert: async (_c, t) => {
      const id = `gorev-${++n}`;
      kayitlar.set(id, { ...t, id, firmTitle: null, createdBy: ctx.sub, createdAt: BUGUN.toISOString(), status: 'Bekliyor', version: 1 } as Task);
      return id;
    },
    update: async (_c, id, version, patch) => {
      const t = kayitlar.get(id);
      if (!t) return 'bulunamadi';
      if (t.version !== version) return 'catisma';
      kayitlar.set(id, { ...t, ...patch, version: t.version + 1 });
      return 'ok';
    },
  };
  const members: MemberPort = { isStaff: async (_c, id) => id === ctx.sub };
  return { tasks, members, kayitlar };
}

function notDeposu() {
  const kayitlar: Note[] = [];
  const notes: NoteRepository = {
    list: async (_c, firmId) => kayitlar.filter((n) => !firmId || n.firmId === firmId),
    insert: async (_c, firmId, body) => {
      const id = `not-${kayitlar.length + 1}`;
      kayitlar.push({ id, firmId, firmTitle: '', body, authorId: ctx.sub, createdAt: BUGUN.toISOString() });
      return id;
    },
  };
  return { notes, kayitlar };
}

describe('demo görevleri', () => {
  it('hepsi alan doğrulamasından geçer', () => {
    for (const g of demoGorevleri(firmalar, 1, BUGUN)) expect(validateTask(g.girdi).ok, g.girdi.title).toBe(true);
  });

  it('sayaçların anlamlı olması için gecikmiş, öncelikli ve tamamlanmış görev birlikte bulunur', () => {
    const g = demoGorevleri(firmalar, 1, BUGUN);
    const sayac = taskCounters(
      g.map((x) => ({ status: x.durum, dueOn: x.girdi.dueOn, assigneeId: ctx.sub })),
      BUGUN_GUN,
      ctx.sub,
    );
    expect(sayac.geciken).toBeGreaterThan(0);
    expect(sayac.oncelikli).toBeGreaterThan(0);
    expect(sayac.tamamlanan).toBeGreaterThan(0);
    expect(sayac.acik).toBeGreaterThan(0);
  });

  it('aynı tohum aynı sonucu verir', () => {
    expect(demoGorevleri(firmalar, 9, BUGUN)).toEqual(demoGorevleri(firmalar, 9, BUGUN));
  });
});

describe('demo görevlerini açma', () => {
  it('görevleri açar ve durumlarını uygular', async () => {
    const d = gorevDeposu();
    const sonuc = await demoGorevleriAc(ctx, firmalar, hepsineIzin, d, { tohum: 1, bugun: BUGUN });
    expect(sonuc.hatalar).toEqual([]);
    expect(sonuc.eklenen).toBe(d.kayitlar.size);
    expect([...d.kayitlar.values()].some((t) => t.status === DONE)).toBe(true);
    expect([...d.kayitlar.values()].some((t) => t.status === 'Öncelikli')).toBe(true);
  });

  it('ikinci kez çalıştırmada görevleri yinelemez', async () => {
    const d = gorevDeposu();
    await demoGorevleriAc(ctx, firmalar, hepsineIzin, d, { tohum: 1, bugun: BUGUN });
    const boyut = d.kayitlar.size;
    const ikinci = await demoGorevleriAc(ctx, firmalar, hepsineIzin, d, { tohum: 1, bugun: BUGUN });
    expect(ikinci.eklenen).toBe(0);
    expect(ikinci.atlanan).toBe(boyut);
    expect(d.kayitlar.size).toBe(boyut);
  });

  it('görev açılamazsa sessizce atlanmaz', async () => {
    const d = gorevDeposu();
    // Sorumlu ofis üyesi değilse createTask 'uye_degil' döner; bu sessizce yutulmamalı
    const yabanci: MemberPort = { isStaff: async () => false };
    const sonuc = await demoGorevleriAc(ctx, firmalar, hepsineIzin, { ...d, members: yabanci }, { tohum: 1, bugun: BUGUN });
    expect(sonuc.hatalar.length).toBeGreaterThan(0);
    expect(sonuc.eklenen).toBe(0);
  });
});

describe('demo notları', () => {
  it('gövdeler not doğrulamasından geçer', () => {
    for (const f of firmalar) for (const g of demoNotlari(f, 1)) expect(validNote(g)).not.toBeNull();
  });

  it('firmalara not ekler ve ikinci koşuda yinelemez', async () => {
    const d = notDeposu();
    const ilk = await demoNotlariAc(ctx, firmalar, d, { tohum: 1 });
    expect(ilk.hatalar).toEqual([]);
    expect(ilk.eklenen).toBeGreaterThan(0);
    const boyut = d.kayitlar.length;
    const ikinci = await demoNotlariAc(ctx, firmalar, d, { tohum: 1 });
    expect(ikinci.eklenen).toBe(0);
    expect(d.kayitlar.length).toBe(boyut);
  });
});

function kurumDeposu() {
  const hesaplar = new Map<string, AccountStatus>();
  const onaylar = new Map<string, Consent>();
  const credentials: CredentialRepository = {
    save: async (_c, i) => {
      const id = `${i.ownerKind}|${i.ownerId}|${i.institution}|${i.label}`;
      hesaplar.set(id, { id, ownerKind: i.ownerKind, ownerId: i.ownerId, institution: i.institution, label: i.label, status: 'active', updatedAt: '', lastSuccessAt: null });
      return { ok: true as const, value: { accountId: id } };
    },
    statuses: async () => [...hesaplar.values()],
    recordLogin: async () => {},
  };
  const consents: ConsentRepository = {
    record: async (_c, firmId, method, consentedOn) => {
      onaylar.set(firmId, { firmId, method, consentedOn } as Consent);
      return { ok: true as const, value: undefined };
    },
    revoke: async () => ({ ok: true as const, value: undefined }),
    status: async (_c, firmId) => onaylar.get(firmId) ?? null,
  };
  return { credentials, consents, hesaplar, onaylar };
}

describe('demo kurum hesapları ve mükellef onayı', () => {
  it('kaydedilen hesaplar gerçek alan doğrulamasından geçer', async () => {
    const d = kurumDeposu();
    const sonuc = await demoKurumHesaplariniAc(ctx, firmalar, hepsineIzin, d, { tohum: 1, bugun: BUGUN });
    expect(sonuc.hatalar).toEqual([]);
    expect(sonuc.hesap).toBe(d.hesaplar.size);
    expect(sonuc.hesap).toBeGreaterThan(0);
    for (const h of d.hesaplar.values()) {
      const alanlar = h.institution === 'GIB' ? { username: 'x', password: 'y' } : h.institution === 'UETS' ? { address: 'x', password: 'y' } : { username: 'x', workplaceCode: '1', systemPassword: 'y', workplacePassword: 'z' };
      expect(validateCredential({ institution: h.institution, ownerKind: h.ownerKind, ...(h.label ? { label: h.label } : {}), fields: alanlar }).ok).toBe(true);
    }
  });

  it('mükellef onayı geçerli yöntemle ve bugünden önce kaydedilir (D46)', async () => {
    const d = kurumDeposu();
    await demoKurumHesaplariniAc(ctx, firmalar, hepsineIzin, d, { tohum: 1, bugun: BUGUN });
    expect(d.onaylar.size).toBeGreaterThan(0);
    for (const o of d.onaylar.values()) {
      expect(CONSENT_METHODS.map((m) => m.id)).toContain(o.method);
      expect(o.consentedOn <= BUGUN_GUN).toBe(true);
    }
  });

  it('onaysız firma da bırakılır: ekranda iki durum da görünür', async () => {
    const d = kurumDeposu();
    await demoKurumHesaplariniAc(ctx, firmalar, hepsineIzin, d, { tohum: 1, bugun: BUGUN });
    expect(d.onaylar.size).toBeLessThan(firmalar.length);
  });

  it('müşavirin kendi GİB hesabı da kaydedilir (sözleşme listesi bu hesapla okunur)', async () => {
    const d = kurumDeposu();
    await demoKurumHesaplariniAc(ctx, firmalar, hepsineIzin, d, { tohum: 1, bugun: BUGUN, musavirId: 'musavir-1' });
    const musavir = [...d.hesaplar.values()].filter((h) => h.ownerKind === 'advisor');
    expect(musavir).toHaveLength(1);
    expect(musavir[0]?.institution).toBe('GIB');
    expect(musavir[0]?.ownerId).toBe('musavir-1');
  });

  it('firma yoksa yalnız müşavir hesabı yazılır', async () => {
    const d = kurumDeposu();
    expect(await demoKurumHesaplariniAc(ctx, [], hepsineIzin, d, { tohum: 1, bugun: BUGUN })).toEqual({ hesap: 0, onay: 0, hatalar: [] });
    expect(await demoKurumHesaplariniAc(ctx, [], hepsineIzin, d, { tohum: 1, bugun: BUGUN, musavirId: 'musavir-1' })).toEqual({ hesap: 1, onay: 0, hatalar: [] });
  });
});
