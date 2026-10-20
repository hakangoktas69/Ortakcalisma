/** Uygulama işareti: defter sayfası + onay çizgisi. Wordmark isteğe bağlı. */
export function Logo({ withText = true, className = "" }: { withText?: boolean; className?: string }) {
  return (
    <span className={`flex items-center gap-2.5 ${className}`}>
      <svg viewBox="0 0 32 32" className="size-8 shrink-0" aria-hidden="true">
        <defs>
          <linearGradient id="mt-logo" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="oklch(67.3% 0.182 276.935)" />
            <stop offset="1" stopColor="oklch(45.7% 0.24 277.023)" />
          </linearGradient>
        </defs>
        <rect x="2" y="2" width="28" height="28" rx="8" fill="url(#mt-logo)" />
        <path d="M10 9.5h9.5l2.5 2.5v10.5H10z" fill="none" stroke="white" strokeOpacity="0.55" strokeWidth="1.6" strokeLinejoin="round" />
        <path d="M12.5 16.2l2.6 2.6 5.4-5.6" fill="none" stroke="oklch(87% 0.15 85)" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      {withText && (
        <span className="leading-tight">
          <span className="block text-[15px] font-extrabold tracking-tight">Mükellef Takip</span>
        </span>
      )}
    </span>
  );
}
