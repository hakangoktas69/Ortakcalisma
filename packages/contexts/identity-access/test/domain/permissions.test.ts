import { describe, expect, it } from 'vitest';
import { features } from '@eworks/feature-registry';
import { covers, effectiveGrants, escalations, isAllowed, ROLE_TEMPLATES, ROLES } from '../../src/domain/permissions.ts';

describe('hiyerarşik yetki', () => {
  it('üst düğüme verilen yetki alt düğümlere miras kalır', () => {
    const g = effectiveGrants('musavir');
    expect(isAllowed(g, 'firmalar.kart.edit')).toBe(true);
    expect(isAllowed(g, 'sgk.ebildirge.sync')).toBe(true);
    expect(covers('firmalar', 'firmalarim.x')).toBe(false);
  });

  it('alt düğümde açık engel üst izni ezer; daha özel izin engeli ezer', () => {
    const g = effectiveGrants('musavir', [{ key: 'sgk', effect: 'deny' }, { key: 'sgk.ebildirge.view', effect: 'allow' }]);
    expect(isAllowed(g, 'sgk.erapor.view')).toBe(false);
    expect(isAllowed(g, 'sgk.ebildirge.view')).toBe(true);
    expect(isAllowed(effectiveGrants('musavir', [{ key: 'firmalar.kart.edit', effect: 'deny' }]), 'firmalar.kart.edit')).toBe(false);
  });

  it('ofis yöneticisi kurum hız politikasını ve satış portalını kullanamaz', () => {
    const g = effectiveGrants('ofis_admin');
    expect(isAllowed(g, 'yonetim.kullanicilar.invite')).toBe(true);
    expect(isAllowed(g, 'yonetim.hiz_politikasi.edit')).toBe(false);
    expect(isAllowed(g, 'satis.ofis.create')).toBe(false);
  });

  it('personel senkron başlatamaz, kurum bilgisi giremez; görev açabilir', () => {
    const g = effectiveGrants('personel');
    expect(isAllowed(g, 'beyanname.senkron.start')).toBe(false);
    expect(isAllowed(g, 'firmalar.gib_sozlesmeler.sync')).toBe(false);
    expect(isAllowed(g, 'firmalar.kurum_hesaplari.edit_credentials')).toBe(false);
    expect(isAllowed(g, 'gorevler.create')).toBe(true);
    expect(isAllowed(g, 'beyanname.liste.view')).toBe(true);
  });

  it('mükellef kendi hesap bilgisini girer ve onay verir; senkron başlatamaz', () => {
    const g = effectiveGrants('mukellef');
    expect(isAllowed(g, 'firmalar.kurum_hesaplari.consent')).toBe(true);
    expect(isAllowed(g, 'firmalar.kurum_hesaplari.grant_use')).toBe(false);
    expect(isAllowed(g, 'beyanname.senkron.start')).toBe(false);
    expect(isAllowed(g, 'firmalar.liste.view')).toBe(false);
    expect(isAllowed(g, 'kisayollar.view')).toBe(false);
  });

  it('[F:genel_bakis.takvim.edit] takvim tarihini yalnız ofis yöneticisi düzeltir; herkes görür', () => {
    expect(isAllowed(effectiveGrants('ofis_admin'), 'genel_bakis.takvim.edit')).toBe(true);
    for (const r of ['musavir', 'personel', 'mukellef'] as const) expect(isAllowed(effectiveGrants(r), 'genel_bakis.takvim.edit'), r).toBe(false);
    for (const r of ['ofis_admin', 'musavir', 'personel'] as const) expect(isAllowed(effectiveGrants(r), 'genel_bakis.takvim.view'), r).toBe(true);
  });

  it('[F:genel_bakis.takvim.sync] takvimi kaynaklardan güncellemek yönetici ve müşavirde; personel ve mükellef başlatamaz', () => {
    for (const r of ['ofis_admin', 'musavir'] as const) expect(isAllowed(effectiveGrants(r), 'genel_bakis.takvim.sync'), r).toBe(true);
    for (const r of ['personel', 'mukellef'] as const) expect(isAllowed(effectiveGrants(r), 'genel_bakis.takvim.sync'), r).toBe(false);
  });

  it('[F:kisayollar.view] portal kısayolları ofis kullanıcılarına açık, mükellefe kapalı', () => {
    for (const r of ['ofis_admin', 'musavir', 'personel'] as const) expect(isAllowed(effectiveGrants(r), 'kisayollar.view'), r).toBe(true);
    expect(isAllowed(effectiveGrants('mukellef'), 'kisayollar.view')).toBe(false);
  });

  it('yetki yükseltme yasak: sahip olunmayan yetki verilemez; personel/mükellef yetki veremez', () => {
    const musavir = { role: 'musavir' as const, grants: effectiveGrants('musavir') };
    expect(escalations(musavir, [{ key: 'gorevler.create', effect: 'allow' }])).toEqual([]);
    expect(escalations(musavir, [{ key: 'yonetim.hiz_politikasi.edit', effect: 'allow' }])).toEqual(['yonetim.hiz_politikasi.edit']);
    expect(escalations({ role: 'personel', grants: effectiveGrants('personel') }, [{ key: 'gorevler.view', effect: 'allow' }])).toEqual(['gorevler.view']);
  });

  it('şablonlardaki her anahtar özellik ağacında var', () => {
    for (const r of ROLES) for (const k of [...ROLE_TEMPLATES[r].allow, ...ROLE_TEMPLATES[r].deny]) expect(features[k], `${r}: ${k}`).toBeDefined();
  });
});
