'use client';

import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useRef } from 'react';

// Firma listesinde yazarken arama (Mert 26.10): kısa bir beklemeden sonra adres süzgeç formunun değerleriyle güncellenir, liste
// sunucuda süzülür. Girdi denetimsizdir (defaultValue); sayfa yenilense de odak ve imleç yerinde kalır. JavaScript yoksa "Süz" çalışır.
const BEKLEME_MS = 350;

export function FirmaArama({ ilk }: { ilk: string }) {
  const router = useRouter();
  const yol = usePathname();
  const zamanlayici = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  useEffect(() => () => clearTimeout(zamanlayici.current), []);

  function degisti(girdi: HTMLInputElement) {
    clearTimeout(zamanlayici.current);
    zamanlayici.current = setTimeout(() => {
      const p = new URLSearchParams();
      if (girdi.form) for (const [ad, deger] of new FormData(girdi.form)) if (typeof deger === 'string' && deger.trim()) p.set(ad, deger);
      router.replace(p.size ? `${yol}?${p}` : yol, { scroll: false });
    }, BEKLEME_MS);
  }

  return (
    <label>
      Ara
      <input name="q" type="search" defaultValue={ilk} maxLength={200} placeholder="Unvan, VKN/TCKN, il, grup…" onChange={(e) => degisti(e.currentTarget)} />
    </label>
  );
}
