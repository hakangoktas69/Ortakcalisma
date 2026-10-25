"use client";

import { useCallback, useEffect, useState } from "react";
import { AlertTriangle, CheckCircle2, Clock, Eye, EyeOff, Puzzle } from "lucide-react";
import { api, formatDate, type ETebligat } from "@/lib/api";
import ExtensionModal from "./ExtensionModal";

/** Tebliğ sayılma durumuna göre etiket: rengin yanında her zaman simge ve metin. */
function ServedBadge({ deemedServedAt }: { deemedServedAt: string }) {
  const d = new Date(deemedServedAt);
  // Takvim günü farkı (saat değil): 12 Ekim'den 17 Ekim'e 5 gün
  const today = new Date();
  const days = Math.round(
    (new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime() - new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime()) /
      86_400_000,
  );
  if (days < 0)
    return (
      <span className="inline-flex items-center gap-1 text-xs text-slate-600">
        <CheckCircle2 size={14} color="#64748b" aria-hidden /> Tebliğ edildi ({formatDate(deemedServedAt)})
      </span>
    );
  return (
    <span className="inline-flex items-center gap-1 text-xs text-slate-800">
      {days <= 2 ? <AlertTriangle size={14} color="#d03b3b" aria-hidden /> : <Clock size={14} color="#fab219" aria-hidden />}
      {formatDate(deemedServedAt)} · {days === 0 ? "bugün" : `${days} gün`}
    </span>
  );
}

export default function TebligatView() {
  const [items, setItems] = useState<ETebligat[]>([]);
  const [status, setStatus] = useState<"open" | "all">("open");
  const [days, setDays] = useState(90);
  const [q, setQ] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [showExtension, setShowExtension] = useState(false);

  const load = useCallback(
    (isAlive: () => boolean = () => true) =>
      api<ETebligat[]>(`/tebligat?status=${status}&days=${days}${q.trim() ? `&q=${encodeURIComponent(q.trim())}` : ""}`).then((r) => {
        if (isAlive()) setItems(r);
      }),
    [status, days, q],
  );

  useEffect(() => {
    let alive = true;
    const t = setTimeout(() => load(() => alive).catch((e) => alive && setError(e.message)), 250);
    return () => {
      alive = false;
      clearTimeout(t);
    };
  }, [load]);

  async function toggleReview(t: ETebligat) {
    try {
      await api(`/tebligat/${t.id}/review`, { method: "PUT", body: JSON.stringify({ reviewed: !t.reviewedAt }) });
      await load();
    } catch (e) {
      setError((e as Error).message);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold">e-Tebligat</h1>
          <p className="text-xs text-slate-500">
            Elektronik tebligat, adrese ulaştığı günü izleyen 5. günün sonunda tebliğ edilmiş sayılır (VUK 107/A); süreler
            o tarihten başlar.
          </p>
        </div>
        <button
          onClick={() => setShowExtension(true)}
          className="flex items-center gap-2 rounded-lg bg-white px-4 py-2 text-sm font-semibold text-orange-700 ring-1 ring-orange-200 hover:bg-orange-50"
        >
          <Puzzle size={16} /> GİB&apos;den aktar
        </button>
      </div>

      {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

      <div className="flex flex-wrap items-center gap-2">
        <input
          placeholder="Firma veya VKN ara…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          className="min-w-0 flex-1 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
        />
        {(
          [
            ["open", "İncelenmemiş"],
            ["all", "Tümü"],
          ] as const
        ).map(([v, l]) => (
          <button
            key={v}
            onClick={() => setStatus(v)}
            className={`rounded-full px-3 py-1 text-sm ${status === v ? "bg-orange-600 text-white" : "bg-white text-slate-700 ring-1 ring-slate-200"}`}
          >
            {l}
          </button>
        ))}
        <select value={days} onChange={(e) => setDays(Number(e.target.value))} className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm">
          <option value={7}>Son 7 gün</option>
          <option value={30}>Son 30 gün</option>
          <option value={90}>Son 90 gün</option>
          <option value={365}>Son 1 yıl</option>
        </select>
      </div>

      <div className="table-scroll overflow-x-auto rounded-xl border border-slate-200 bg-white">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500">
            <tr>
              <th className="px-4 py-3">Ulaşma</th>
              <th className="px-4 py-3">Firma</th>
              <th className="px-4 py-3">Konu / gönderen</th>
              <th className="px-4 py-3">Tebliğ sayılma</th>
              <th className="px-4 py-3">GİB&apos;de okunma</th>
              <th className="px-4 py-3">Büro</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {items.map((t) => (
              <tr key={t.id} className={`hover:bg-slate-50 ${t.reviewedAt ? "" : "bg-orange-50/40"}`}>
                <td className="px-4 py-2.5 whitespace-nowrap">{formatDate(t.deliveredAt)}</td>
                <td className="px-4 py-2.5">
                  <p className="font-medium">{t.company.title}</p>
                  <p className="font-mono text-xs text-slate-500">{t.company.taxNumber}</p>
                </td>
                <td className="px-4 py-2.5">
                  <p>{t.subject ?? "—"}</p>
                  <p className="text-xs text-slate-500">
                    {t.sender ?? ""} {t.source === "DEMO" && <span className="rounded bg-slate-100 px-1">demo</span>}
                  </p>
                </td>
                <td className="px-4 py-2.5">
                  <ServedBadge deemedServedAt={t.deemedServedAt} />
                </td>
                <td className="px-4 py-2.5 text-xs">{t.readAtGib ? formatDate(t.readAtGib) : "Okunmadı"}</td>
                <td className="px-4 py-2.5">
                  <button
                    onClick={() => toggleReview(t)}
                    className={`inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-semibold ${
                      t.reviewedAt ? "text-slate-500 hover:bg-slate-100" : "bg-orange-600 text-white hover:bg-orange-700"
                    }`}
                    title={t.reviewedAt ? "İncelenmedi olarak işaretle" : "İncelendi olarak işaretle"}
                  >
                    {t.reviewedAt ? <EyeOff size={14} /> : <Eye size={14} />}
                    {t.reviewedAt ? `İncelendi ${formatDate(t.reviewedAt)}` : "İncelendi"}
                  </button>
                </td>
              </tr>
            ))}
            {items.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-slate-500">
                  {status === "open" ? "İncelenmemiş tebligat yok" : "Bu aralıkta tebligat yok"}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-slate-500">
        &quot;İncelendi&quot; sadece büro içi takiptir; GİB&apos;deki okunma durumunu değiştirmez.
      </p>

      {showExtension && (
        <ExtensionModal
          onClose={() => {
            setShowExtension(false);
            load();
          }}
        />
      )}
    </div>
  );
}
