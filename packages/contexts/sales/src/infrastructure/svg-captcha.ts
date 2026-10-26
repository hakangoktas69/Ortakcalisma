import svgCaptcha from 'svg-captcha';
import { CAPTCHA_CHARS, CAPTCHA_LENGTH } from '../domain/captcha.ts';
import type { CaptchaGenerator } from '../application/sales-auth.ts';

// Resimli güvenlik kodu (D41): harfler SVG içinde metin değil çizim (path) olarak üretilir, gürültü çizgileri eklenir.
// Dış servis yok: veri yurt dışına gitmez, CSP değişmez (görüntü data: adresiyle). Paket: svg-captcha 1.4.0 (MIT;
// 2019'dan beri sürüm yok — bilinen sapma, K-48). Yanıt yalnız Redis'te, 5 dk ve tek kullanımlık.
export class SvgCaptchaGenerator implements CaptchaGenerator {
  create() {
    const c = svgCaptcha.create({ size: CAPTCHA_LENGTH, noise: 3, charPreset: CAPTCHA_CHARS, width: 160, height: 56, fontSize: 52, color: false });
    return { text: c.text, svg: c.data };
  }
}
