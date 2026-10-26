'use client';

import { usePathname } from 'next/navigation';

/**
 * Üst çubuktaki konum ("Eworks / <sayfa>"). Yerleşim sunucuda adresi bilmez; başlık tablosu sunucudan gelir, burada
 * adresin en uzun eşleşen önekiyle seçilir (`/firmalar/kart/<id>` → "Firma kartı"). Tabloda yalnız özellik başlıkları vardır.
 */
export function Konum({ basliklar }: { basliklar: Record<string, string> }) {
  const adres = usePathname() ?? '/';
  let yol = adres;
  while (!(yol in basliklar) && yol.includes('/') && yol !== '/') yol = yol.slice(0, yol.lastIndexOf('/')) || '/';
  return <strong className="konum-baslik">{basliklar[yol] ?? 'Eworks'}</strong>;
}
