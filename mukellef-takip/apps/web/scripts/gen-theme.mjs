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
const palettes = ['slate', 'red', 'orange', 'amber', 'yellow', 'green', 'emerald', 'teal', 'sky', 'blue', 'indigo', 'violet', 'purple', 'rose'];
const steps = ['50', '100', '200', '300', '400', '500', '600', '700', '800', '900', '950'];

const val = {};
for (const m of theme.matchAll(/--color-([a-z]+)-(\d+):\s*([^;]+);/g)) val[`${m[1]}-${m[2]}`] = m[3].trim();

// Nötr gri'yi temiz nötr zinc yap (sıcak/mavi değil). globals.css @theme ile aynı.
Object.assign(val, {
  'slate-50': 'oklch(98.5% 0.001 286)',
  'slate-100': 'oklch(96.7% 0.001 286)',
  'slate-200': 'oklch(92% 0.004 286)',
  'slate-300': 'oklch(87.1% 0.006 286)',
  'slate-400': 'oklch(70.5% 0.015 286)',
  'slate-500': 'oklch(55.2% 0.016 286)',
  'slate-600': 'oklch(44.2% 0.017 286)',
  'slate-700': 'oklch(37% 0.013 286)',
  'slate-800': 'oklch(27.4% 0.006 286)',
  'slate-900': 'oklch(21% 0.006 286)',
  'slate-950': 'oklch(14.1% 0.005 286)',
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
