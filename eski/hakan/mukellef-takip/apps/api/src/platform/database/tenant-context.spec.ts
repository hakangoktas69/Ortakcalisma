import { describe, expect, it } from 'vitest';
import { currentDbContext, runAsSystem, runAsTenant, runWithDbContext, setCurrentTenant } from './tenant-context.js';

/** PrismaPromise gibi tembel thenable: işi ancak .then çağrılınca, o anki bağlamda yapar. */
// oxlint-disable-next-line unicorn/no-thenable -- PrismaPromise'u taklit etmek için bilerek thenable
const lazyQuery = () => ({ then: (ok: (v: unknown) => void) => ok(currentDbContext()) });

describe('veritabanı bağlamı', () => {
  it('tembel sorgu bağlamın içinde başlatılır (await dışarıda olsa da)', async () => {
    expect(await runAsSystem(lazyQuery)).toEqual({ system: true });
    expect(await runAsTenant('t1', lazyQuery)).toEqual({ tenantId: 't1' });
  });

  it('istek bağlamı sonradan büroyu alır ve async devamlarda korunur', async () => {
    await runWithDbContext(async () => {
      expect(currentDbContext()).toEqual({});
      setCurrentTenant('t9');
      await new Promise((r) => setTimeout(r, 1));
      expect(currentDbContext()?.tenantId).toBe('t9');
      // Sistem bağlamı yalnız kendi içinde geçerli
      expect(await runAsSystem(lazyQuery)).toEqual({ system: true });
      expect(currentDbContext()?.tenantId).toBe('t9');
    });
  });

  it('bağlam yokken büro atamak hata verir (sessizce RLS dışı kalmaz)', () => {
    expect(() => setCurrentTenant('t1')).toThrow();
  });
});
