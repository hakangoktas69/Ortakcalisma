// Çizgi simgeleri (Mert'in Eworks tasarımındaki ICONS kümesi). Süsleme amaçlıdır: ekran okuyucudan gizlenir,
// anlamı her zaman yanındaki metin ya da düğmenin erişilebilir adı taşır.

const YOLLAR = {
  refresh: <path d="M20 7v5h-5M4 17v-5h5M5.5 8a7 7 0 0 1 11.6-3L20 8M4 16l2.9 3A7 7 0 0 0 18.5 16" />,
  clock: <><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></>,
  download: <path d="M12 3v12m-5-5 5 5 5-5M4 17v4h16v-4" />,
  home: (
    <>
      <rect x="3" y="3" width="18" height="18" rx="4" />
      <path d="M3 9h18M9 9v12" />
    </>
  ),
  calendar: (
    <>
      <rect x="3" y="5" width="18" height="16" rx="2" />
      <path d="M7 3v4m10-4v4M3 10h18m-12 5h6" />
    </>
  ),
  firms: (
    <>
      <rect x="3" y="6" width="18" height="15" rx="2" />
      <path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M3 13h18m-11 0v2h4v-2" />
    </>
  ),
  file: (
    <>
      <path d="M6 2h8l5 5v13a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2z" />
      <path d="M14 2v5h5M8 12h8M8 16h7" />
    </>
  ),
  mail: (
    <>
      <rect x="2" y="5" width="20" height="14" rx="3" />
      <path d="m3 7 9 7 9-7" />
    </>
  ),
  shield: (
    <>
      <path d="M12 2 20 6v6c0 5-3.3 8.7-8 10-4.7-1.3-8-5-8-10V6z" />
      <path d="m9 12 2 2 4-4" />
    </>
  ),
  users: <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8ZM22 21v-2a4 4 0 0 0-3-3.9M16 3.2a4 4 0 0 1 0 7.6" />,
  book: (
    <>
      <path d="M4 3h15a2 2 0 0 1 2 2v14H6a3 3 0 0 0-3 3V5a2 2 0 0 1 1-2ZM6 19a3 3 0 0 0-3 3h18" />
      <path d="M9 8h7M9 12h7" />
    </>
  ),
  clipboard: (
    <>
      <rect x="4" y="4" width="16" height="18" rx="2" />
      <rect x="9" y="2" width="6" height="4" rx="1" />
      <path d="m8 14 3 3 5-6" />
    </>
  ),
  invoice: (
    <>
      <rect x="4" y="2" width="16" height="20" rx="2" />
      <path d="M8 7h8M8 11h8M8 15h4M15 15h1" />
    </>
  ),
  chart: (
    <>
      <path d="M4 21h16M7 18v-6m5 6V5m5 13v-9" />
      <circle cx="7" cy="8" r="1" />
    </>
  ),
  wallet: (
    <>
      <rect x="2" y="6" width="20" height="15" rx="3" />
      <path d="M5 6V4a2 2 0 0 1 2-2h12m-3 11h6" />
    </>
  ),
  settings: (
    <>
      <circle cx="12" cy="12" r="3" />
      <path d="m19.4 15 .1 2.2-2.3 2.3-2.2-1-2 1.2-2 1.3-2.1-1.4-2.3.1-1.3-2.7-2.4-1v-3l2.4-1 .7-2.2-1-2.4 2.1-2.1 2.3 1 2-1.3L13 3l2.1 1.3 2.4-1 2.1 2.1-1 2.4 1.3 2L22 12l-.9 2.2z" />
    </>
  ),
  help: (
    <>
      <circle cx="12" cy="12" r="10" />
      <path d="M9 9a3 3 0 0 1 6 0c0 2-3 2.5-3 5m0 3h.01" />
    </>
  ),
  bell: <path d="M18 8a6 6 0 0 0-12 0c0 7-3 8-3 10h18c0-2-3-3-3-10ZM10 21h4" />,
  out: (
    <>
      <path d="M10 17l5-5-5-5m5 5H3" />
      <path d="M12 3h6a3 3 0 0 1 3 3v12a3 3 0 0 1-3 3h-6" />
    </>
  ),
  arrow: <path d="M5 12h14m-6-6 6 6-6 6" />,
  link: <path d="M14 3h7v7M21 3l-9 9M10 5H5a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-5" />,
  right: <path d="m9 5 7 7-7 7" />,
  left: <path d="m15 5-7 7 7 7" />,
  check: <path d="m5 12 4 4L19 6" />,
  folder: <path d="M2 6a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2z" />,
  user: (
    <>
      <circle cx="12" cy="8" r="4" />
      <path d="M4 21a8 8 0 0 1 16 0" />
    </>
  ),
  lock: (
    <>
      <rect x="4" y="10" width="16" height="11" rx="2" />
      <path d="M8 10V7a4 4 0 0 1 8 0v3" />
    </>
  ),
  grid: (
    <>
      <rect x="3" y="3" width="7" height="7" rx="1" />
      <rect x="14" y="3" width="7" height="7" rx="1" />
      <rect x="3" y="14" width="7" height="7" rx="1" />
      <rect x="14" y="14" width="7" height="7" rx="1" />
    </>
  ),
};

export type SimgeAdi = keyof typeof YOLLAR;

export function Simge({ ad, className = 'simge' }: { ad: SimgeAdi; className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      {YOLLAR[ad]}
    </svg>
  );
}
