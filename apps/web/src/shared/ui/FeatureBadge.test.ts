import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { FeatureBadge, FeatureGate } from './FeatureBadge.tsx';
import { durumGosterilir } from './ozellik.ts';
import { Gelistiriliyor } from './Sayfa.tsx';

// D39: TDD özellik durumu (kırmızı "Geliştiriliyor", yeşil "Tamamlandı", kırmızı çerçeve) yalnız geliştirme ve hata ayıklama
// kipinde görünür (OZELLIK_DURUMU_GOSTER=true, yığın betiği yazar). Demo ve üretimde portal normal renklerinde ve görünümünde.

const KIRMIZI = 'odeme.aylik_liste';
const YESIL = 'oturum.giris.login';
const DUGME = createElement('button', null, 'Kaydet');
const rozet = (k: string) => renderToStaticMarkup(createElement(FeatureBadge, { k }));
const kapi = (k: string) => renderToStaticMarkup(createElement(FeatureGate, { k, children: DUGME }));
const sayfa = (k: string) => renderToStaticMarkup(createElement(Gelistiriliyor, { k }));

afterEach(() => vi.unstubAllEnvs());

describe('özellik durumu görünürlüğü', () => {
  it('yalnız OZELLIK_DURUMU_GOSTER=true iken görünür; verilmezse ya da başka değerde gizli', () => {
    expect(durumGosterilir({ OZELLIK_DURUMU_GOSTER: 'true' })).toBe(true);
    expect(durumGosterilir({ OZELLIK_DURUMU_GOSTER: 'false' })).toBe(false);
    expect(durumGosterilir({ OZELLIK_DURUMU_GOSTER: '1' })).toBe(false);
    expect(durumGosterilir({})).toBe(false);
  });

  it('geliştirme görünümünde kırmızı ve yeşil rozet ile kırmızı çerçeve çizilir', () => {
    vi.stubEnv('OZELLIK_DURUMU_GOSTER', 'true');
    expect(rozet(KIRMIZI)).toContain('rozet kirmizi');
    expect(rozet(KIRMIZI)).toContain('Geliştiriliyor');
    expect(rozet(YESIL)).toContain('Tamamlandı');
    expect(kapi(KIRMIZI)).toContain('kapi kirmizi');
  });

  it('normal görünümde rozet yok, çerçeve yok; sarılan düğme olduğu gibi kalır', () => {
    vi.stubEnv('OZELLIK_DURUMU_GOSTER', 'false');
    expect(rozet(KIRMIZI)).toBe('');
    expect(rozet(YESIL)).toBe('');
    const html = kapi(KIRMIZI);
    expect(html).toContain('<button>Kaydet</button>');
    expect(html).not.toMatch(/kirmizi|Geliştiriliyor|data-durum|data-ozellik/);
  });

  it('uygulanmamış sayfa normal görünümde sade bir "yakında" metni gösterir; işlem anahtarı ve TDD dili yok', () => {
    vi.stubEnv('OZELLIK_DURUMU_GOSTER', 'false');
    const html = sayfa(KIRMIZI);
    expect(html).toContain('Aylık ödeme listesi');
    expect(html).toContain('yakında');
    expect(html).not.toMatch(/kirmizi|Geliştiriliyor|kabul test|<code>/);
  });

  it('uygulanmamış sayfa geliştirme görünümünde işlemleri durumlarıyla listeler', () => {
    vi.stubEnv('OZELLIK_DURUMU_GOSTER', 'true');
    const html = sayfa(KIRMIZI);
    expect(html).toContain('rozet kirmizi');
    expect(html).toContain('kabul testleri');
  });
});
