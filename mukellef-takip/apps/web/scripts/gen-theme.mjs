// globals.css içindeki koyu tema bloklarını Tailwind'in kendi renk değerlerinden üretir:
//  - ".dark": her renk ölçeği ters çevrilir (50 ↔ 950), beyaz koyu yüzey olur
//  - ".dark .ink": koyu lacivert alanlar (kenar çubuğu, giriş paneli) her iki temada aynı kalsın diye
//    renkler orijinal değerlerine döner
// Tailwind sürümü değişirse yeniden çalıştırın:  node apps/web/scripts/gen-theme.mjs
import { readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const theme = readFileSync(require.resolve('tailwindcss/theme.css'), 'utf8');
const cssPath = new URL('../src/app/globals.css', import.meta.url);
const palettes = ['slate', 'red', 'orange', 'amber', 'yellow', 'green', 'emerald', 'teal', 'sky', 'blue', 'indigo', 'violet', 'purple', 'rose', 'brand'];
const steps = ['50', '100', '200', '300', '400', '500', '600', '700', '800', '900', '950'];

const val = {};
for (const m of theme.matchAll(/--color-([a-z]+)-(\d+):\s*([^;]+);/g)) val[`${m[1]}-${m[2]}`] = m[3].trim();

// Nötr gri'yi sıcak nötr taupe yap (mavi/yeşil değil). globals.css @theme ile aynı.
Object.assign(val, {
  'slate-50': 'oklch(98.4% 0.003 60)',
  'slate-100': 'oklch(96.8% 0.004 60)',
  'slate-200': 'oklch(92.9% 0.006 58)',
  'slate-300': 'oklch(86.9% 0.008 56)',
  'slate-400': 'oklch(70.4% 0.01 54)',
  'slate-500': 'oklch(55.4% 0.011 52)',
  'slate-600': 'oklch(44.6% 0.012 50)',
  'slate-700': 'oklch(37.2% 0.012 48)',
  'slate-800': 'oklch(27.9% 0.012 47)',
  'slate-900': 'oklch(20.8% 0.011 46)',
  'slate-950': 'oklch(12.9% 0.01 46)',
});

// Özel marka ölçeği: altın / amber (Tailwind'de yok). globals.css @theme ile aynı; koyu temada da ters çevrilsin.
Object.assign(val, {
  'brand-50': 'oklch(96.5% 0.018 85)',
  'brand-100': 'oklch(93% 0.035 84)',
  'brand-200': 'oklch(87% 0.062 82)',
  'brand-300': 'oklch(79% 0.09 81)',
  'brand-400': 'oklch(70.5% 0.115 80)',
  'brand-500': 'oklch(63% 0.125 78)',
  'brand-600': 'oklch(57% 0.12 77)',
  'brand-700': 'oklch(49% 0.1 75)',
  'brand-800': 'oklch(42% 0.082 73)',
  'brand-900': 'oklch(36% 0.065 71)',
  'brand-950': 'oklch(25% 0.045 68)',
});

let dark = `.dark {\n  color-scheme: dark;\n  --color-white: ${val['slate-900']};\n`;
let ink = `.dark .ink {\n  color-scheme: light;\n  --color-white: #fff;\n`;
for (const p of palettes)
  steps.forEach((s, i) => {
    dark += `  --color-${p}-${s}: ${val[`${p}-${steps[steps.length - 1 - i]}`]};\n`;
    ink += `  --color-${p}-${s}: ${val[`${p}-${s}`]};\n`;
  });
const block = `/* gen-theme:start */\n${dark}}\n\n${ink}}\n/* gen-theme:end */`;

const css = readFileSync(cssPath, 'utf8');
const next = css.includes('/* gen-theme:start */')
  ? css.replace(/\/\* gen-theme:start \*\/[\s\S]*?\/\* gen-theme:end \*\//, block)
  : css.replace(/\.dark \{\n  color-scheme: dark;[\s\S]*?\n\}/, block);
writeFileSync(cssPath, next);
console.log('globals.css koyu tema blokları güncellendi');
