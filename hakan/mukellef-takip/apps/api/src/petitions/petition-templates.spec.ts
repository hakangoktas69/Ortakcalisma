import { describe, expect, it } from 'vitest';
import { BUILTIN_TEMPLATES, fieldLabel, fill, placeholders } from './petition-templates.js';

describe('placeholders', () => {
  it('sırayla ve tekrarsız', () => {
    expect(placeholders('{{a}} {{b_c}} {{a}}')).toEqual(['a', 'b_c']);
  });
  it('her hazır şablonda en az firma unvanı ve VKN var', () => {
    for (const t of BUILTIN_TEMPLATES) expect(placeholders(t.body)).toEqual(expect.arrayContaining(['firma_unvani', 'vkn']));
  });
});

describe('fill', () => {
  it('dolu değerleri yazar, boş/eksik olanları yer tutucu olarak bırakır', () => {
    expect(fill('{{a}} - {{b}} - {{c}}', { a: 'X', b: '  ' })).toBe('X - {{b}} - {{c}}');
  });
  it('kullanıcının değerindeki süslü parantezleri yeniden işlemez', () => {
    expect(fill('{{a}}', { a: '{{b}}', b: 'Y' })).toBe('{{b}}');
  });
});

describe('fieldLabel', () => {
  it('bilinen ve bilinmeyen alanlar', () => {
    expect(fieldLabel('vkn')).toBe('VKN / TCKN');
    expect(fieldLabel('ozel_alan')).toBe('Ozel alan');
  });
});
