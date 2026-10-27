import { describe, expect, it } from 'vitest';
import { PORTAL_GROUPS, PORTAL_LINKS } from '../../src/index.ts';

// Portal kısayolları (Mert 26.10, 3fbab28): kurumların resmî giriş sayfaları. Eworks bu sayfalara kimlik bilgisi aktarmaz.
describe('portal kısayolları', () => {
  it('her bağlantı HTTPS ve resmî .gov.tr alan adında; kullanıcı bilgisi, sorgu ve parça yok', () => {
    expect(PORTAL_LINKS.length).toBeGreaterThan(0);
    for (const l of PORTAL_LINKS) {
      const u = new URL(l.url);
      expect(u.protocol, l.id).toBe('https:');
      expect(u.hostname, l.id).toMatch(/\.gov\.tr$/);
      expect(u.username + u.password + u.search + u.hash, l.id).toBe('');
    }
  });

  it('kimlikler tekil, her bağlantı bilinen bir grupta, her grubun bağlantısı var', () => {
    const idler = PORTAL_LINKS.map((l) => l.id);
    expect(new Set(idler).size).toBe(idler.length);
    const gruplar = PORTAL_GROUPS.map((g) => g.id);
    for (const l of PORTAL_LINKS) expect(gruplar).toContain(l.group);
    for (const g of gruplar) expect(PORTAL_LINKS.some((l) => l.group === g), g).toBe(true);
  });

  it('GİB ve SGK sayfaları listede', () => {
    expect(PORTAL_LINKS.filter((l) => l.group === 'gib').map((l) => l.title)).toEqual(expect.arrayContaining(['Dijital Vergi Dairesi', 'İnternet Vergi Dairesi', 'e-Beyanname']));
    expect(PORTAL_LINKS.filter((l) => l.group === 'sgk').map((l) => l.title)).toEqual(expect.arrayContaining(['SGK e-Bildirge V2', 'İşe Giriş / İşten Çıkış']));
  });
});
