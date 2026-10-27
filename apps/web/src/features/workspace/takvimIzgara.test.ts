import { describe, expect, it } from 'vitest';
import { araligi, ayIzgarasi, gorunumOku, kaydir } from './takvimIzgara.ts';

// Takvim ekranının tarih ızgarası (Mert'in 42 hücreli, pazartesi başlangıçlı aylık görünümü) ve görünüm aralıkları.
describe('takvim ızgarası', () => {
  it('ay: 42 gün, pazartesi başlar, ayın günleri işaretli', () => {
    const g = ayIzgarasi('2026-10-15');
    expect(g).toHaveLength(42);
    expect(g[0]).toEqual({ tarih: '2026-09-28', buAy: false });
    expect(g.find((h) => h.tarih === '2026-10-01')).toEqual({ tarih: '2026-10-01', buAy: true });
    expect(g.filter((h) => h.buAy)).toHaveLength(31);
    expect(g[41]!.tarih).toBe('2026-11-08');
  });

  it('görünüm aralıkları: ay ızgarası, hafta (pazartesi–pazar), gün, yıl, liste (ay)', () => {
    expect(araligi('ay', '2026-10-15')).toEqual({ from: '2026-09-28', to: '2026-11-08' });
    expect(araligi('hafta', '2026-10-15')).toEqual({ from: '2026-10-12', to: '2026-10-18' });
    expect(araligi('gun', '2026-10-15')).toEqual({ from: '2026-10-15', to: '2026-10-15' });
    expect(araligi('yil', '2026-10-15')).toEqual({ from: '2026-01-01', to: '2026-12-31' });
    expect(araligi('liste', '2026-02-10')).toEqual({ from: '2026-02-01', to: '2026-02-28' });
  });

  it('önceki/sonraki: ay sonundan taşmadan ay kayar; hafta 7 gün, yıl 1 yıl', () => {
    expect(kaydir('ay', '2026-01-31', 1)).toBe('2026-02-01');
    expect(kaydir('liste', '2026-03-31', -1)).toBe('2026-02-01');
    expect(kaydir('hafta', '2026-12-30', 1)).toBe('2027-01-06');
    expect(kaydir('gun', '2026-12-31', 1)).toBe('2027-01-01');
    expect(kaydir('yil', '2026-10-15', -1)).toBe('2025-01-01');
  });

  it('adres parametreleri doğrulanır; geçersizse bugün ve aylık görünüm', () => {
    expect(gorunumOku({ gorunum: 'hafta', tarih: '2026-10-15' }, '2026-10-27')).toEqual({ gorunum: 'hafta', tarih: '2026-10-15' });
    expect(gorunumOku({ gorunum: 'xx', tarih: '2026-02-30' }, '2026-10-27')).toEqual({ gorunum: 'ay', tarih: '2026-10-27' });
    expect(gorunumOku({}, '2026-10-27')).toEqual({ gorunum: 'ay', tarih: '2026-10-27' });
  });
});
