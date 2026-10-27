import { describe, expect, it } from 'vitest';
import { matchesSearch, normalizeSearch, searchRank } from '../../src/index.ts';

// Firma unvanı araması (Mert 26.10, 3c6ad8f): Türkçe/ASCII harf farkı yok sayılır, her kelime aranır, unvanla başlayan önce gelir.
describe('firma araması', () => {
  it('Türkçe harfleri, büyük/küçük harfi ve fazla boşluğu normalleştirir', () => {
    expect(normalizeSearch('  KABUL   Gıda ŞİRKETİ Çağ Öğün Üzüm ')).toBe('kabul gida sirketi cag ogun uzum');
    expect(normalizeSearch('İstanbul')).toBe(normalizeSearch('istanbul'));
    expect(normalizeSearch('ISPARTA')).toBe('isparta');
  });

  it('her kelime alanlardan birinde geçmelidir; sıra önemsizdir', () => {
    const alanlar = ['Kabul Gıda Ltd. Şti.', 'Kadıköy', 'İstanbul'];
    expect(matchesSearch(alanlar, 'gida kabul')).toBe(true);
    expect(matchesSearch(alanlar, 'kabul kadikoy')).toBe(true);
    expect(matchesSearch(alanlar, 'kabul ankara')).toBe(false);
    expect(matchesSearch(alanlar, '   ')).toBe(true);
    expect(matchesSearch([null, undefined, 'X'], 'x')).toBe(true);
  });

  it('sıralama: tam unvan → unvanla başlayan → unvanda geçen → başka alanda geçen', () => {
    expect(searchRank('Kabul', 'kabul')).toBe(0);
    expect(searchRank('Kabul Gıda', 'kabul')).toBe(1);
    expect(searchRank('Yeni Kabul Gıda', 'kabul')).toBe(2);
    expect(searchRank('Ankara Ltd', 'kabul')).toBe(3);
  });
});
