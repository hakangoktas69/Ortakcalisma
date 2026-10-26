import { describe, expect, it } from 'vitest';
import { listOffices, openOfficeForSale, type OfficeSaleDeps, type SalesAccountRecord } from '../../src/index.ts';

// Satışın ofis listesi ve "yeni ofis" akışı. Hesap açma (kimlik + dizin + shard) mevcut `openOffice` use-case'iyle yapılır;
// burada in-memory portlarla. Gerçek akış: test/infrastructure/satis.int.test.ts ve apps/sales e2e.

const simdi = new Date('2026-10-26T09:00:00Z');
const gun = (n: number) => new Date(simdi.getTime() + n * 86_400_000);
const satisci = { userId: 's-1', email: 'satis@eworks.test', fullName: 'Selin Satış', csrf: 'c', mustChangePassword: false };

function kur() {
  const kimlikler = new Map<string, { id: string; password: string }>();
  const ofisler = new Map<string, { id: string; name: string; frozen: boolean }>();
  const uyeler: { orgId: string; userId: string; role: string; by?: string }[] = [];
  const hesaplar = new Map<string, SalesAccountRecord>();
  const satisDenetim: { salesUserId: string | null; action: string; subject: string | null; details?: Record<string, string | number> }[] = [];
  const kilitler = new Map<string, string>();
  const birakilan: { anahtar: string; jeton: string }[] = [];
  let n = 0;
  const d: OfficeSaleDeps = {
    identity: {
      createUser: async (email, password) => {
        if (kimlikler.has(email)) return 'exists';
        const id = `k${++n}`;
        kimlikler.set(email, { id, password });
        return { id };
      },
      signIn: async (email, password) => (kimlikler.get(email)?.password === password ? { accessToken: email } : null),
      verify: async (t) => (kimlikler.has(t) ? { id: kimlikler.get(t)!.id } : null),
    },
    directory: {
      leastLoadedShard: async () => 'shard-01',
      createOrganization: async (o) => void ofisler.set(o.id, { id: o.id, name: o.name, frozen: false }),
      addUserOrg: async () => {},
      organizationByName: async (name) => [...ofisler.values()].find((o) => o.name === name) ?? null,
    },
    tenant: {
      createOrganization: async () => {},
      addMember: async (orgId, m, by) => void uyeler.push({ orgId, userId: m.userId, role: m.role, ...(by ? { by } : {}) }),
      isMember: async (orgId, userId) => uyeler.some((u) => u.orgId === orgId && u.userId === userId),
    },
    accounts: {
      // Gerçek adaptörde hesap ve satış denetimi tek veritabanı işleminde yazılır
      insert: async (a, e) => {
        hesaplar.set(a.orgId, a);
        satisDenetim.push(e);
      },
      list: async () => [...hesaplar.values()].map((a) => ({ ...a, officeName: ofisler.get(a.orgId)!.name, frozen: ofisler.get(a.orgId)!.frozen })),
    },
    locks: {
      acquire: async (k) => {
        if (kilitler.has(k)) return null;
        const jeton = `jeton-${++n}`;
        kilitler.set(k, jeton);
        return jeton;
      },
      // Yalnız kilidi alan bırakır (başka isteğin kilidini silmez)
      release: async (k, jeton) => {
        birakilan.push({ anahtar: k, jeton });
        if (kilitler.get(k) === jeton) kilitler.delete(k);
      },
    },
    crypto: { tempPassword: () => `GeciciParola${++n}x` },
    clock: { now: () => simdi },
    newId: () => `o${++n}`,
  };
  return { d, kimlikler, ofisler, uyeler, hesaplar, satisDenetim, kilitler, birakilan };
}

const form = { officeName: 'Yıldız Mali Müşavirlik', contactName: 'Ayşe Yıldız', email: 'ayse@ornek.test', phone: '0532 123 45 67', plan: 'pro', trialDays: '14' };

describe('yeni ofis (satış)', () => {
  it('[F:satis.ofis.create] ofis + yönetici müşavir + deneme lisansı birlikte açılır; geçici parola bir kez döner; iki denetim kaydı', async () => {
    const t = kur();
    const r = await openOfficeForSale(satisci, form, t.d);
    expect(r).toMatchObject({ ok: true, value: { email: 'ayse@ornek.test', tempPassword: expect.stringMatching(/^GeciciParola/) } });
    if (!r.ok) return;
    expect(t.kimlikler.get('ayse@ornek.test')?.password).toBe(r.value.tempPassword);
    expect(t.uyeler).toEqual([{ orgId: r.value.orgId, userId: t.kimlikler.get('ayse@ornek.test')!.id, role: 'ofis_admin', by: 's-1' }]);
    expect(t.hesaplar.get(r.value.orgId)).toEqual({
      orgId: r.value.orgId, contactName: 'Ayşe Yıldız', contactEmail: 'ayse@ornek.test', contactPhone: '905321234567', plan: 'pro',
      trialEndsAt: gun(14), expiresAt: gun(14), createdBy: 's-1', createdAt: simdi,
    });
    // Satış denetimi: kim, hangi ofisi; kişisel veri (e-posta, telefon) yazılmaz. Ofisin kendi denetimi shard'da (tenant.addMember by)
    expect(t.satisDenetim).toEqual([{ salesUserId: 's-1', action: 'satis.ofis.acildi', subject: r.value.orgId, details: { paket: 'pro', deneme_gun: 14 } }]);
    expect(JSON.stringify(t.satisDenetim)).not.toMatch(/ayse|5321234567/);
    expect(t.kilitler.size).toBe(0);
    // Kilidi alan, aldığı jetonla bırakır
    expect(t.birakilan).toEqual([{ anahtar: 'ofis-ac:yıldız mali müşavirlik', jeton: expect.stringMatching(/^jeton-/) }]);
  });

  it('[F:satis.ofis.create] form hataları alan alan döner, hiçbir kayıt açılmaz', async () => {
    const t = kur();
    const r = await openOfficeForSale(satisci, { ...form, email: 'x', plan: 'bedava' }, t.d);
    expect(r).toMatchObject({ ok: false, error: 'gecersiz', errors: [{ field: 'email' }, { field: 'plan' }] });
    expect(t.ofisler.size + t.kimlikler.size + t.hesaplar.size).toBe(0);
  });

  it('[F:satis.ofis.create] aynı adlı ofis ve kullanımdaki e-posta reddedilir; ofis yarım kalmaz', async () => {
    const t = kur();
    expect((await openOfficeForSale(satisci, form, t.d)).ok).toBe(true);
    expect(await openOfficeForSale(satisci, { ...form, officeName: ' Yıldız Mali Müşavirlik ', email: 'baska@ornek.test' }, t.d)).toEqual({ ok: false, error: 'ofis_var' });
    expect(await openOfficeForSale(satisci, { ...form, officeName: 'Başka Ofis' }, t.d)).toEqual({ ok: false, error: 'eposta_kullanimda' });
    expect(t.ofisler.size).toBe(1);
    expect(t.hesaplar.size).toBe(1);
  });

  it('[F:satis.ofis.create] aynı ofis için eşzamanlı ikinci istek (çift tıklama) beklemeden reddedilir', async () => {
    const t = kur();
    await t.d.locks.acquire('ofis-ac:yıldız mali müşavirlik', 120);
    expect(await openOfficeForSale(satisci, form, t.d)).toEqual({ ok: false, error: 'islem_suruyor' });
    expect(t.ofisler.size).toBe(0);
  });

  it('[F:satis.ofis.create] ara adımda hata olursa kilit yine bırakılır', async () => {
    const t = kur();
    t.d.accounts.insert = async () => {
      throw new Error('veritabanı kesintisi');
    };
    await expect(openOfficeForSale(satisci, form, t.d)).rejects.toThrow('veritabanı kesintisi');
    expect(t.kilitler.size).toBe(0);
  });
});

describe('ofis listesi (satış)', () => {
  it('[F:satis.ofis.view] durum lisanstan hesaplanır; ada, yetkiliye göre arama ve durum süzgeci; ad sırasıyla', async () => {
    const t = kur();
    const a = await openOfficeForSale(satisci, { ...form, officeName: 'Zeytin Müşavirlik', email: 'z@ornek.test' }, t.d);
    const b = await openOfficeForSale(satisci, { ...form, officeName: 'Çınar Müşavirlik', email: 'c@ornek.test', contactName: 'Can Çınar' }, t.d);
    if (!a.ok || !b.ok) throw new Error('açılamadı');
    t.hesaplar.set(b.value.orgId, { ...t.hesaplar.get(b.value.orgId)!, expiresAt: gun(-1) });
    t.ofisler.set(a.value.orgId, { ...t.ofisler.get(a.value.orgId)!, frozen: true });
    const hepsi = await listOffices({}, t.d);
    expect(hepsi.map((o) => [o.officeName, o.status])).toEqual([['Çınar Müşavirlik', 'suresi_doldu'], ['Zeytin Müşavirlik', 'donduruldu']]);
    expect(hepsi[0]).toMatchObject({ contactPhone: '+90 532 123 45 67', planName: 'Pro' });
    expect((await listOffices({ q: 'çınar' }, t.d)).map((o) => o.officeName)).toEqual(['Çınar Müşavirlik']);
    expect((await listOffices({ q: 'CAN' }, t.d)).map((o) => o.officeName)).toEqual(['Çınar Müşavirlik']);
    expect((await listOffices({ status: 'donduruldu' }, t.d)).map((o) => o.officeName)).toEqual(['Zeytin Müşavirlik']);
    expect(await listOffices({ status: 'gecersiz' }, t.d)).toHaveLength(2);
  });
});
