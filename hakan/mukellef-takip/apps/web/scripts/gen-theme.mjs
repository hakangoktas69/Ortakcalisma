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
