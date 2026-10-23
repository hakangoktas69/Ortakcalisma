"use client";

import { useState } from "react";
import { AlertTriangle, CheckCircle2, Clock, History, type LucideIcon } from "lucide-react";
import type { ControlStatus, StatusCounts } from "@/lib/api";

// Durum renkleri ayrılmıştır (iyi / uyarı / ciddi / kritik) ve her zaman simge + etiketle birlikte kullanılır;
// renk tek başına anlam taşımaz. Metinler seri rengini değil mürekkep tonlarını kullanır.
export const STATUS_META: Record<ControlStatus, { label: string; color: string; icon: LucideIcon }> = {
  FILED: { label: "Verildi", color: "#a87f22", icon: CheckCircle2 },
  FILED_LATE: { label: "Geç verildi", color: "#ec835a", icon: History },
  PENDING: { label: "Bekliyor", color: "#fab219", icon: Clock },
  LATE: { label: "Gecikti", color: "#d03b3b", icon: AlertTriangle },
};
export const STATUS_ORDER: ControlStatus[] = ["FILED", "FILED_LATE", "PENDING", "LATE"];

export function StatusBadge({ status }: { status: ControlStatus }) {
  const { label, color, icon: Icon } = STATUS_META[status];
  return (
    <span className="inline-flex items-center gap-1 whitespace-nowrap text-xs text-slate-700">
      <Icon size={14} color={color} aria-hidden /> {label}
    </span>
  );
}

export function StatusLegend() {
  return (
    <div className="flex flex-wrap gap-x-4 gap-y-1">
      {STATUS_ORDER.map((s) => (
        <StatusBadge key={s} status={s} />
      ))}
    </div>
  );
}

/**
 * Tür başına yatay yığılmış durum çubuğu. Segmentler arasında 2px boşluk, uçlar yuvarlatılmış;
 * fareyle üzerine gelince segmentin adet ve oranı gösterilir. Tablo görünümü sayfadaki matristir.
 */
export function StatusBars({
  rows,
}: {
  rows: { key: string; label: string; sublabel?: string; counts: StatusCounts }[];
}) {
  const [hover, setHover] = useState<{ key: string; status: ControlStatus } | null>(null);
  return (
    <div className="space-y-3">
      {rows.map((r) => {
        const total = STATUS_ORDER.reduce((s, k) => s + r.counts[k], 0);
        const segments = STATUS_ORDER.filter((k) => r.counts[k] > 0);
        const active = hover?.key === r.key ? hover.status : null;
        return (
          <div key={r.key} className="grid grid-cols-[7.5rem_1fr_2.5rem] items-center gap-3 text-sm">
            <div className="min-w-0">
              <p className="truncate font-medium text-slate-800">{r.label}</p>
              {r.sublabel && <p className="truncate text-[11px] text-slate-500">{r.sublabel}</p>}
            </div>
            <div className="relative">
              <div className="flex h-3 gap-[2px]" role="img" aria-label={`${r.label}: ${segments.map((k) => `${STATUS_META[k].label} ${r.counts[k]}`).join(", ")}`}>
                {segments.map((k, i) => (
                  <div
                    key={k}
                    onMouseEnter={() => setHover({ key: r.key, status: k })}
                    onMouseLeave={() => setHover(null)}
                    className="relative h-full cursor-default"
                    style={{
                      width: `${(r.counts[k] / total) * 100}%`,
                      background: STATUS_META[k].color,
                      opacity: active && active !== k ? 0.45 : 1,
                      borderTopLeftRadius: i === 0 ? 4 : 0,
                      borderBottomLeftRadius: i === 0 ? 4 : 0,
                      borderTopRightRadius: i === segments.length - 1 ? 4 : 0,
                      borderBottomRightRadius: i === segments.length - 1 ? 4 : 0,
                    }}
                  >
                    {/* Hedef alanı çubuktan geniş: ince çubukta da kolay yakalanır */}
                    <span className="absolute -inset-y-2 inset-x-0" />
                  </div>
                ))}
              </div>
              {active && (
                <div className="pointer-events-none absolute -top-9 left-0 z-10 whitespace-nowrap rounded-md bg-slate-900 px-2 py-1 text-xs text-white shadow">
                  {STATUS_META[active].label}: <b>{r.counts[active]}</b> / {total} ({Math.round((r.counts[active] / total) * 100)}%)
                </div>
              )}
            </div>
            <p className="text-right text-xs tabular-nums text-slate-500">{total}</p>
          </div>
        );
      })}
    </div>
  );
}
