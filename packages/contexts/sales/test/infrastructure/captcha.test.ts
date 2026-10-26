import { describe, expect, it } from 'vitest';
import { CAPTCHA_CHARS, CAPTCHA_LENGTH } from '../../src/index.ts';
import { SvgCaptchaGenerator } from '../../src/infrastructure/svg-captcha.ts';

// Güvenlik kodu üreteci birim testi (bağımlılıksız): alfabe, uzunluk, harflerin metin değil çizim olması.
describe('resimli güvenlik kodu üreteci (svg-captcha)', () => {
  const uretec = new SvgCaptchaGenerator();

  it('kod alfabeden ve sabit uzunlukta; her üretim farklı', () => {
    const kodlar = Array.from({ length: 20 }, () => uretec.create().text);
    for (const k of kodlar) {
      expect(k).toHaveLength(CAPTCHA_LENGTH);
      for (const c of k) expect(CAPTCHA_CHARS).toContain(c);
    }
    expect(new Set(kodlar).size).toBeGreaterThan(15);
  });

  it('SVG harfleri metin olarak taşımaz (ekran okuyucu/bot doğrudan okuyamaz), betik içermez', () => {
    const { text, svg } = uretec.create();
    expect(svg.startsWith('<svg')).toBe(true);
    expect(svg).not.toContain(text);
    expect(svg).not.toMatch(/<text|<script|on\w+=/i);
  });
});
