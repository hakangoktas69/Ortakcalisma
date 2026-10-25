import { describe, expect, it } from 'vitest';
import { fakeTckn, fakeVkn, seededRandom } from '@eworks/testing';
import { inSegment, validateFirm } from '../../src/index.ts';

const rnd = seededRandom(7);

describe('firma kartı doğrulaması', () => {
  it('geçerli kartı normalleştirir; VKN/TCKN türünü belirler', () => {
    const vkn = fakeVkn(rnd);
    const r = validateFirm({ title: '  Örnek   Gıda Ltd. Şti. ', kind: 'Limited', taxId: ` ${vkn} `, email: 'muhasebe@eworks.test', phone: '+90 (212) 555 00 00' });
    expect(r.ok && r.value).toMatchObject({ title: 'Örnek Gıda Ltd. Şti.', taxId: vkn, taxIdKind: 'VKN', taxRegime: 'Belirtilmedi', status: 'Onay Bekliyor', city: null });
    const t = validateFirm({ title: 'Ahmet Yılmaz', kind: 'Şahıs', taxId: fakeTckn(rnd) });
    expect(t.ok && t.value.taxIdKind).toBe('TCKN');
  });

  it('eksik unvan, geçersiz kimlik, şirkette TCKN, bozuk e-posta ve geçersiz seçenekleri alan bazında reddeder', () => {
    const r = validateFirm({ title: ' ', kind: 'Limited', taxId: fakeTckn(rnd), email: 'x@', status: 'Silindi', taxRegime: 'Yok' });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors.map((e) => e.alan).sort()).toEqual(['email', 'status', 'taxId', 'taxRegime', 'title']);
    const v = fakeVkn(rnd);
    const bozukVkn = v.slice(0, 9) + String((Number(v[9]) + 1) % 10);
    const k = validateFirm({ title: 'X', kind: 'Kooperatif', taxId: bozukVkn });
    expect(!k.ok && k.errors.map((e) => e.alan)).toEqual(['kind', 'taxId']);
  });

  it('hata mesajları girilen kimlik numarasını içermez', () => {
    const r = validateFirm({ title: 'X', kind: 'Şahıs', taxId: '99999999999' });
    expect(JSON.stringify(r)).not.toContain('99999999999');
  });

  it('eski portalın segmentleri', () => {
    const f = { kind: 'Şahıs' as const, status: 'Aktif' as const, taxRegime: 'Basit Usul' as const };
    expect(['all', 'approved', 'simple', 'personal'].every((s) => inSegment(f, s as never))).toBe(true);
    expect(inSegment(f, 'corporate') || inSegment(f, 'pending')).toBe(false);
  });
});
