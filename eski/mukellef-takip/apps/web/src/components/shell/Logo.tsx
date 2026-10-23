import { BRAND } from "@/content/brand";

/** Uygulama işareti: defter sayfası + onay çizgisi. Yazı (ad, isteğe bağlı kısa tanım) content/brand.ts'ten gelir. */
export function Logo({ withText = true, withTagline = false, className = "" }: { withText?: boolean; withTagline?: boolean; className?: string }) {
  return (
    <span className={`flex items-center gap-2.5 ${className}`}>
      {/* Zemin SVG gradyanı yerine CSS: sayfada birden fazla logo varken paylaşılan gradyan kimliği gizli logoya bağlanıp kayboluyordu */}
      <span
        className="flex size-8 shrink-0 items-center justify-center rounded-[9px]"
        style={{ background: "linear-gradient(135deg, oklch(67.3% 0.182 276.935), oklch(45.7% 0.24 277.023))" }}
      >
        <svg viewBox="0 0 32 32" className="size-8" aria-hidden="true">
          <path d="M10 9.5h9.5l2.5 2.5v10.5H10z" fill="none" stroke="white" strokeOpacity="0.55" strokeWidth="1.6" strokeLinejoin="round" />
          <path d="M12.5 16.2l2.6 2.6 5.4-5.6" fill="none" stroke="oklch(87% 0.15 85)" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </span>
      {withText && (
        <span className="leading-tight">
          <span className="block text-[15px] font-extrabold tracking-tight">{BRAND.name}</span>
          {withTagline && <span className="block text-xs font-medium opacity-60">{BRAND.tagline}</span>}
        </span>
      )}
    </span>
  );
}
