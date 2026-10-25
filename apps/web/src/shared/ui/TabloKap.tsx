/**
 * Yatay kayan tablo kabı. Dar ekranda tablo kendi kabında kayar (sayfa taşmaz); kap adlı, odaklanabilir bir bölgedir,
 * böylece klavye kullanıcısı da ok tuşlarıyla kaydırabilir (WCAG 2.1.1, axe scrollable-region-focusable).
 */
export function TabloKap({ etiket, children }: { etiket: string; children: React.ReactNode }) {
  return (
    <div className="tablo-kap" role="region" aria-label={etiket} tabIndex={0}>
      {children}
    </div>
  );
}
