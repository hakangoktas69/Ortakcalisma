import { BadgePercent } from "lucide-react";

/** Satış portalı logosu: müşavir portalının adı + turuncu "Satış" etiketi. */
export function Logo({ dark = false }: { dark?: boolean }) {
  return (
    <span className="inline-flex items-center gap-2">
      <span className={`flex size-8 items-center justify-center rounded-lg ${dark ? "bg-brand-600 text-white" : "bg-white/20 text-white"}`}>
        <BadgePercent size={18} />
      </span>
      <span className={`text-base font-bold ${dark ? "text-slate-900" : "text-white"}`}>Mükellef Takip</span>
      <span className={`rounded-md px-1.5 py-0.5 text-xs font-bold uppercase ${dark ? "bg-brand-100 text-brand-800" : "bg-white text-brand-700"}`}>Satış</span>
    </span>
  );
}
