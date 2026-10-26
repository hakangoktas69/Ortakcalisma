import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { KipEtiketi, yiginKipiEtiketi } from './KipEtiketi.tsx';

// Logo yanında yığın kipi (D39): demo, gelistirme, debug adıyla görünür; üretimde ya da kip bilinmiyorsa hiçbir şey çizilmez.

afterEach(() => vi.unstubAllEnvs());

describe('yığın kipi etiketi', () => {
  it('demo, gelistirme ve debug kipinin adını verir', () => {
    expect(yiginKipiEtiketi({ YIGIN_KIPI: 'demo' })).toBe('Demo');
    expect(yiginKipiEtiketi({ YIGIN_KIPI: 'gelistirme' })).toBe('Geliştirme');
    expect(yiginKipiEtiketi({ YIGIN_KIPI: 'debug' })).toBe('Debug');
  });

  it('üretimde, kip verilmediğinde ya da bilinmeyen değerde etiket yok', () => {
    expect(yiginKipiEtiketi({ YIGIN_KIPI: 'uretim' })).toBeNull();
    expect(yiginKipiEtiketi({})).toBeNull();
    expect(yiginKipiEtiketi({ YIGIN_KIPI: '<script>' })).toBeNull();
  });

  it('etiket ekran okuyucuya ne olduğunu söyler; üretimde hiçbir öğe çizilmez', () => {
    vi.stubEnv('YIGIN_KIPI', 'demo');
    const html = renderToStaticMarkup(createElement(KipEtiketi));
    expect(html).toContain('kip-etiketi');
    expect(html).toContain('Yığın kipi:');
    expect(html).toContain('Demo');
    vi.stubEnv('YIGIN_KIPI', 'uretim');
    expect(renderToStaticMarkup(createElement(KipEtiketi))).toBe('');
  });
});
