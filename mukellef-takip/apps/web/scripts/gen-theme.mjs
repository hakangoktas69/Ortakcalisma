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

// Nötr gri'yi sıcak zeytin-gri yap (Tailwind'in mavi-grisinin yerine). globals.css @theme ile aynı.
Object.assign(val, {
  'slate-50': 'oklch(98.4% 0.004 140)',
  'slate-100': 'oklch(96.8% 0.006 140)',
  'slate-200': 'oklch(92.9% 0.011 140)',
  'slate-300': 'oklch(86.9% 0.016 141)',
  'slate-400': 'oklch(70.4% 0.022 142)',
  'slate-500': 'oklch(55.4% 0.025 143)',
  'slate-600': 'oklch(44.6% 0.026 145)',
  'slate-700': 'oklch(37.2% 0.027 147)',
  'slate-800': 'oklch(27.9% 0.028 148)',
  'slate-900': 'oklch(20.8% 0.027 150)',
  'slate-950': 'oklch(12.9% 0.025 150)',
});

// Özel marka ölçeği: zeytin yeşili (Tailwind'de yok). globals.css @theme ile aynı; koyu temada da ters çevrilsin.
Object.assign(val, {
  'brand-50': 'oklch(96.5% 0.018 128)',
  'brand-100': 'oklch(92.5% 0.035 127)',
  'brand-200': 'oklch(86% 0.055 127)',
  'brand-300': 'oklch(77.5% 0.072 127)',
  'brand-400': 'oklch(68% 0.085 128)',
  'brand-500': 'oklch(59% 0.09 128)',
  'brand-600': 'oklch(51% 0.086 128)',
  'brand-700': 'oklch(44% 0.075 128)',
  'brand-800': 'oklch(38% 0.062 129)',
  'brand-900': 'oklch(32.5% 0.05 130)',
  'brand-950': 'oklch(23% 0.035 132)',
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
