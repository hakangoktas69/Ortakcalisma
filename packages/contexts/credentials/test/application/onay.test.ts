import { describe, expect, it } from 'vitest';
import { CONSENT_METHODS, consentStatus, recordConsent, revokeConsent, type Consent, type ConsentRepository } from '../../src/index.ts';

// Mükellef onayı (CredentialConsent, D18/D46): müşavir mükelleften aldığı yazılı onayı tarih ve yöntemle beyan eder; geri alınabilir.
const ctx = { sub: 'u-1', org: 'o-1' };
const izinli = (k: string) => k === 'firmalar.kurum_hesaplari.consent';

function depo() {
  const kayit = new Map<string, Consent>();
  const r: ConsentRepository = {
    record: async (_c, firmId, method, consentedOn) => {
      if (firmId === 'baska') return { ok: false, error: 'bulunamadi' };
      if (!kayit.get(firmId)?.active) kayit.set(firmId, { firmId, method, consentedOn, recordedAt: '2026-10-27T10:00:00.000Z', active: true });
      return { ok: true, value: undefined };
    },
    revoke: async (_c, firmId) => {
      const k = kayit.get(firmId);
      if (!k?.active) return { ok: false, error: 'bulunamadi' };
      kayit.set(firmId, { ...k, active: false });
      return { ok: true, value: undefined };
    },
    status: async (_c, firmId) => kayit.get(firmId) ?? null,
  };
  return { r, kayit };
}

describe('mükellef onayı', () => {
  it('[F:firmalar.kurum_hesaplari.consent] onay beyanla kaydedilir, durumda görünür, geri alınır', async () => {
    const d = depo();
    expect(await recordConsent(ctx, { firmId: 'f-1', method: 'sozlesme', consentedOn: '2026-10-20', attested: true }, izinli, d.r, '2026-10-27')).toEqual({ ok: true, value: undefined });
    expect(await consentStatus(ctx, 'f-1', d.r)).toMatchObject({ active: true, method: 'sozlesme', consentedOn: '2026-10-20' });
    expect(await revokeConsent(ctx, 'f-1', izinli, d.r)).toEqual({ ok: true, value: undefined });
    expect((await consentStatus(ctx, 'f-1', d.r))?.active).toBe(false);
  });

  it('beyan kutusu işaretlenmeden, gelecek ya da geçersiz tarihle, bilinmeyen yöntemle kayıt olmaz; yetkisiz ve kapsam dışı reddedilir', async () => {
    const d = depo();
    const g = { firmId: 'f-1', method: 'sozlesme', consentedOn: '2026-10-20', attested: true };
    expect(await recordConsent(ctx, { ...g, attested: false }, izinli, d.r, '2026-10-27')).toEqual({ ok: false, error: 'beyan_yok' });
    expect(await recordConsent(ctx, { ...g, consentedOn: '2026-10-28' }, izinli, d.r, '2026-10-27')).toEqual({ ok: false, error: 'gecersiz' });
    expect(await recordConsent(ctx, { ...g, consentedOn: '2026-02-30' }, izinli, d.r, '2026-10-27')).toEqual({ ok: false, error: 'gecersiz' });
    expect(await recordConsent(ctx, { ...g, consentedOn: '2026-13-01' }, izinli, d.r, '2026-10-27')).toEqual({ ok: false, error: 'gecersiz' });
    expect(await recordConsent(ctx, { ...g, method: 'telefon' }, izinli, d.r, '2026-10-27')).toEqual({ ok: false, error: 'gecersiz' });
    expect(await recordConsent(ctx, g, () => false, d.r, '2026-10-27')).toEqual({ ok: false, error: 'yetki_yok' });
    expect(await revokeConsent(ctx, 'f-1', () => false, d.r)).toEqual({ ok: false, error: 'yetki_yok' });
    expect(await recordConsent(ctx, { ...g, firmId: 'baska' }, izinli, d.r, '2026-10-27')).toEqual({ ok: false, error: 'bulunamadi' });
    expect(d.kayit.size).toBe(0);
  });

  it('yöntemler: sözleşme, dilekçe, e-posta, diğer yazılı', () => {
    expect(CONSENT_METHODS.map((m) => m.id)).toEqual(['sozlesme', 'dilekce', 'eposta', 'diger']);
  });
});
