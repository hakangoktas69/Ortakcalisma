"use client";

import { Plus, Search } from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { btnPrimary, card, ErrorBox, input, PageTitle, StatusBadge } from "@/components/ui";
import { api, errorText, type OfficeRow, type OfficeStatus } from "@/lib/api";
import { daysLeft, formatDate, formatPhone, STATUS_LABEL } from "@/lib/format";

const FILTERS: (OfficeStatus | "hepsi")[] = ["hepsi", "deneme", "aktif", "suresi-doldu", "donduruldu"];

/** Bürolar (müşavir hesapları) listesi: arama, durum süzgeci, lisans bitişi. */
export default function OfficesPage() {
  const [rows, setRows] = useState<OfficeRow[] | null>(null);
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState<OfficeStatus | "hepsi">("hepsi");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Yazarken her tuşta istek atılmasın
    const timer = setTimeout(() => {
      const params = new URLSearchParams();
      if (q.trim()) params.set("q", q.trim());
      api<OfficeRow[]>(`/offices${params.size ? `?${params}` : ""}`).then(setRows, (e) => setError(errorText(e)));
    }, 250);
    return () => clearTimeout(timer);
  }, [q]);

  const counts = useMemo(() => {
    const c: Record<string, number> = { hepsi: rows?.length ?? 0 };
    for (const r of rows ?? []) c[r.status] = (c[r.status] ?? 0) + 1;
    return c;
  }, [rows]);
  const visible = (rows ?? []).filter((r) => filter === "hepsi" || r.status === filter);

  return (
    <>
      <PageTitle
        title="Bürolar"
        subtitle="Sisteme kayıtlı mali müşavir büroları"
        actions={
          <Link href="/yeni" className={btnPrimary}>
            <Plus size={16} /> Yeni müşavir ekle
          </Link>
        }
      />
      <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center">
        <div className="relative lg:w-96">
          <Search size={16} className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-slate-400" />
          <input
            className={`${input} pl-9`}
            placeholder="Büro, müşavir, e-posta ya da telefon ara"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            aria-label="Ara"
          />
        </div>
        <div className="flex gap-1 overflow-x-auto" role="tablist" aria-label="Durum">
          {FILTERS.map((f) => (
            <button
              key={f}
              role="tab"
              aria-selected={filter === f}
              onClick={() => setFilter(f)}
              className={`shrink-0 rounded-lg px-3 py-1.5 text-sm font-semibold ${filter === f ? "bg-brand-600 text-white" : "bg-white text-slate-700 ring-1 ring-slate-200 hover:bg-slate-50"}`}
            >
              {f === "hepsi" ? "Hepsi" : STATUS_LABEL[f]} <span className="opacity-70">{counts[f] ?? 0}</span>
            </button>
          ))}
        </div>
      </div>
      <ErrorBox message={error} />
      <div className={`${card} table-scroll overflow-x-auto`}>
        <table className="w-full text-left text-sm">
          <thead className="border-b border-slate-200 bg-slate-50 text-xs font-semibold text-slate-600 uppercase">
            <tr>
              <th className="px-4 py-3">Büro</th>
              <th className="px-4 py-3">Yetkili</th>
              <th className="px-4 py-3">Telefon</th>
              <th className="px-4 py-3">Durum</th>
              <th className="px-4 py-3">Lisans bitişi</th>
              <th className="px-4 py-3 text-right">Mükellef</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {rows === null && (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-slate-500">
                  Yükleniyor…
                </td>
              </tr>
            )}
            {rows !== null && visible.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-slate-500">
                  Kayıt yok
                </td>
              </tr>
            )}
            {visible.map((r) => {
              const left = daysLeft(r.expiresAt);
              return (
                <tr key={r.id} className="hover:bg-orange-50/50">
                  <td className="px-4 py-3">
                    <Link href={`/buro/${r.id}`} className="font-semibold text-brand-800 hover:underline">
                      {r.name}
                    </Link>
                  </td>
                  <td className="px-4 py-3">
                    <div className="text-slate-800">{r.contactName ?? "—"}</div>
                    <div className="text-xs text-slate-500">{r.contactEmail}</div>
                  </td>
                  <td className="px-4 py-3">{formatPhone(r.contactPhone)}</td>
                  <td className="px-4 py-3">
                    <StatusBadge status={r.status} />
                  </td>
                  <td className="px-4 py-3">
                    {formatDate(r.expiresAt)}
                    {left !== null && left >= 0 && left <= 7 && <span className="ml-2 text-xs font-semibold text-amber-700">{left} gün</span>}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums">{r.companyCount}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </>
  );
}
