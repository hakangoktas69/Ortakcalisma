"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Puzzle, RefreshCw, Settings2, X } from "lucide-react";
import {
  api,
  companyTypeLabel,
  formatDate,
  type ControlCell,
  type ControlStatus,
  type DeclarationControl,
  type DeclarationType,
} from "@/lib/api";
import { StatusBadge, StatusBars, StatusLegend } from "./StatusBars";
import ExtensionModal from "./ExtensionModal";

type Row = DeclarationControl["rows"][number];

function defaultMonth() {
  const d = new Date();
  d.setDate(1);
  d.setMonth(d.getMonth() - 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

const tl = (n: number) => n.toLocaleString("tr-TR", { style: "currency", currency: "TRY" });
const input = "w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-violet-500";

function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-30 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div className="w-full max-w-md rounded-2xl bg-white p-5 shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-bold">{title}</h2>
          <button onClick={onClose} className="rounded p-1 text-slate-500 hover:bg-slate-100" aria-label="Kapat">
            <X size={18} />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

export default function BeyannameView() {
  const [month, setMonth] = useState(() => {
    // Bildirimden gelinmişse (/beyanname?month=2026-09) o dönemi aç
    const m = typeof window !== "undefined" ? new URLSearchParams(window.location.search).get("month") : null;
    return m && /^d{4}-d{2}$/.test(m) ? m : defaultMonth();
  });
  const [data, setData] = useState<DeclarationControl | null>(null);
  const [filter, setFilter] = useState<"all" | "open">("all");
  const [q, setQ] = useState("");
  const [msg, setMsg] = useState<{ kind: "ok" | "err"; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [selected, setSelected] = useState<{ row: Row; cell: ControlCell } | null>(null);
  const [obligationsFor, setObligationsFor] = useState<Row["company"] | null>(null);
  const [showExtension, setShowExtension] = useState(false);

  const load = useCallback(
    (isAlive: () => boolean = () => true) =>
      api<DeclarationControl>(`/declarations/control?month=${month}`).then((d) => {
        if (isAlive()) setData(d);
      }),
    [month],
  );

  useEffect(() => {
    let alive = true;
    load(() => alive).catch((e) => alive && setMsg({ kind: "err", text: e.message }));
    return () => {
      alive = false;
    };
  }, [load]);

  async function syncGib() {
    setBusy(true);
    setMsg(null);
    try {
      const r = await api<{ fetched: number; created: number }>(`/declarations/sync?month=${month}`, { method: "POST" });
      setMsg({ kind: "ok", text: `GİB'den ${r.fetched} beyanname okundu, ${r.created} yeni kayıt eklendi.` });
      await load();
    } catch (e) {
      setMsg({ kind: "err", text: (e as Error).message });
    } finally {
      setBusy(false);
    }
  }

  const open = (s: ControlStatus) => s === "PENDING" || s === "LATE";
  const rows = useMemo(() => {
    if (!data) return [];
    const needle = q.trim().toLocaleLowerCase("tr");
    return data.rows.filter(
      (r) =>
        (!needle || r.company.title.toLocaleLowerCase("tr").includes(needle) || r.company.taxNumber.includes(needle)) &&
        (filter === "all" || r.cells.some((c) => open(c.status))),
    );
  }, [data, q, filter]);

  const totals = useMemo(() => {
    const t: Record<ControlStatus, number> = { FILED: 0, FILED_LATE: 0, PENDING: 0, LATE: 0 };
    data?.types.forEach((x) => (Object.keys(t) as ControlStatus[]).forEach((k) => (t[k] += x.counts[k])));
    return t;
  }, [data]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold">Beyanname Kontrol</h1>
          <p className="text-xs text-slate-500">{data?.periodLabel ?? "…"} dönemi · aktif firmaların yükümlü olduğu beyannameler</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <input
            type="month"
            value={month}
            onChange={(e) => e.target.value && setMonth(e.target.value)}
            className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
            aria-label="Dönem"
          />
          <button
            onClick={() => setShowExtension(true)}
            className="flex items-center gap-2 rounded-lg bg-white px-4 py-2 text-sm font-semibold text-violet-700 ring-1 ring-violet-200 hover:bg-violet-50"
          >
            <Puzzle size={16} /> GİB&apos;den aktar
          </button>
          <button
            onClick={syncGib}
            disabled={busy}
            className="flex items-center gap-2 rounded-lg bg-violet-600 px-4 py-2 text-sm font-semibold text-white hover:bg-violet-700 disabled:opacity-60"
          >
            <RefreshCw size={16} className={busy ? "animate-spin" : ""} /> Demo veriyi yenile
          </button>
        </div>
      </div>

      {data?.mode === "mock" && (
        <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
          <b>Demo modu:</b> &quot;Demo veriyi yenile&quot; sahte beyanname üretir. Gerçek veriler için &quot;GİB&apos;den
          aktar&quot; ile tarayıcı eklentisini kullanın. Son günler genel
          kurala göre hesaplanır (hafta sonu → ilk iş günü); resmi tatil ve süre uzatımları için GİB vergi takvimini
          esas alın.
        </p>
      )}
      {msg && (
        <p className={`rounded-lg px-3 py-2 text-sm ${msg.kind === "ok" ? "bg-emerald-50 text-emerald-800" : "bg-red-50 text-red-700"}`}>
          {msg.text}
        </p>
      )}

      {data && (
        <section className="rounded-2xl border border-slate-200 bg-white p-4 md:p-5">
          <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="font-bold">Tür bazında durum</h2>
              <p className="text-xs text-slate-500">
                {totals.FILED + totals.FILED_LATE} verildi · {totals.PENDING} bekliyor · {totals.LATE} gecikti
              </p>
            </div>
            <StatusLegend />
          </div>
          <StatusBars
            rows={data.types.map((t) => ({
              key: t.type,
              label: t.short,
              sublabel: `son gün ${formatDate(t.dueDate)}`,
              counts: t.counts,
            }))}
          />
        </section>
      )}

      <div className="flex flex-wrap gap-2">
        <input
          placeholder="Firma veya VKN ara…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          className="min-w-0 flex-1 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
        />
        {(
          [
            ["all", "Tümü"],
            ["open", "Sadece eksikler"],
          ] as const
        ).map(([v, l]) => (
          <button
            key={v}
            onClick={() => setFilter(v)}
            className={`rounded-full px-3 py-1 text-sm ${filter === v ? "bg-violet-600 text-white" : "bg-white text-slate-700 ring-1 ring-slate-200"}`}
          >
            {l}
          </button>
        ))}
      </div>

      {data && (
        <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500">
              <tr>
                <th className="sticky left-0 bg-slate-50 px-4 py-3">Firma</th>
                {data.types.map((t) => (
                  <th key={t.type} className="px-3 py-3 whitespace-nowrap" title={`${t.label} · ${t.periodLabel}`}>
                    {t.short}
                    <span className="block text-[10px] font-normal normal-case">son gün {formatDate(t.dueDate)}</span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {rows.map((r) => (
                <tr key={r.company.id} className="hover:bg-slate-50">
                  <td className="sticky left-0 bg-white px-4 py-2">
                    <div className="flex items-center gap-2">
                      <div className="min-w-0">
                        <p className="truncate font-medium">{r.company.title}</p>
                        <p className="text-xs text-slate-500">
                          {companyTypeLabel[r.company.type]} · <span className="font-mono">{r.company.taxNumber}</span>
                        </p>
                      </div>
                      <button
                        onClick={() => setObligationsFor(r.company)}
                        className="ml-auto rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                        title="Beyanname yükümlülükleri"
                      >
                        <Settings2 size={15} />
                      </button>
                    </div>
                  </td>
                  {data.types.map((t) => {
                    const cell = r.cells.find((c) => c.type === t.type);
                    return (
                      <td key={t.type} className="px-3 py-2">
                        {cell ? (
                          <button
                            onClick={() => setSelected({ row: r, cell })}
                            className="rounded-md px-1.5 py-1 hover:bg-slate-100"
                            title={cell.declaration ? `Verildi: ${formatDate(cell.declaration.filedAt)}` : "Ayrıntı / elle işaretle"}
                          >
                            <StatusBadge status={cell.status} />
                          </button>
                        ) : (
                          <span className="text-xs text-slate-300" title="Bu firmanın yükümlülüğü değil">
                            —
                          </span>
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}
              {rows.length === 0 && (
                <tr>
                  <td colSpan={(data.types.length || 0) + 1} className="px-4 py-8 text-center text-slate-500">
                    Kayıt yok
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {selected && data && (
        <CellModal
          row={selected.row}
          cell={selected.cell}
          typeLabel={data.types.find((t) => t.type === selected.cell.type)?.label ?? selected.cell.type}
          onClose={() => setSelected(null)}
          onChanged={(text) => {
            setSelected(null);
            setMsg({ kind: "ok", text });
            load();
          }}
        />
      )}
      {showExtension && (
        <ExtensionModal
          onClose={() => {
            setShowExtension(false);
            load();
          }}
        />
      )}
      {obligationsFor && (
        <ObligationsModal
          company={obligationsFor}
          onClose={() => setObligationsFor(null)}
          onSaved={() => {
            setObligationsFor(null);
            setMsg({ kind: "ok", text: `${obligationsFor.title} yükümlülükleri güncellendi.` });
            load();
          }}
        />
      )}
    </div>
  );
}

function CellModal({
  row,
  cell,
  typeLabel,
  onClose,
  onChanged,
}: {
  row: Row;
  cell: ControlCell;
  typeLabel: string;
  onClose: () => void;
  onChanged: (msg: string) => void;
}) {
  const [filedAt, setFiledAt] = useState(() => new Date().toISOString().slice(0, 10));
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const d = cell.declaration;

  async function mark(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      await api("/declarations", {
        method: "POST",
        body: JSON.stringify({
          companyId: row.company.id,
          type: cell.type,
          period: cell.period,
          filedAt: new Date(`${filedAt}T12:00:00`).toISOString(),
          ...(amount ? { accrualAmount: Number(amount.replace(",", ".")) } : {}),
          ...(note ? { note } : {}),
        }),
      });
      onChanged(`${row.company.title} · ${typeLabel} verildi olarak işaretlendi.`);
    } catch (err) {
      setError((err as Error).message);
    }
  }

  async function unmark() {
    if (!d) return;
    try {
      await api(`/declarations/${d.id}`, { method: "DELETE" });
      onChanged(`${row.company.title} · ${typeLabel} işareti geri alındı.`);
    } catch (err) {
      setError((err as Error).message);
    }
  }

  return (
    <Modal title={typeLabel} onClose={onClose}>
      <div className="space-y-3 text-sm">
        <p>
          <b>{row.company.title}</b>
          <br />
          <span className="text-slate-500">
            Son gün {formatDate(cell.dueDate)} · <StatusBadge status={cell.status} />
          </span>
        </p>
        {d ? (
          <>
            <dl className="grid grid-cols-[8rem_1fr] gap-y-1 rounded-lg bg-slate-50 p-3">
              <dt className="text-slate-500">Verilme tarihi</dt>
              <dd>{formatDate(d.filedAt)}</dd>
              <dt className="text-slate-500">Tahakkuk</dt>
              <dd>{d.accrualAmount != null ? tl(d.accrualAmount) : "—"}</dd>
              <dt className="text-slate-500">Referans no</dt>
              <dd className="font-mono text-xs">{d.referenceNo ?? "—"}</dd>
              <dt className="text-slate-500">Kaynak</dt>
              <dd>{d.source === "MANUAL" ? "Elle işaretlendi" : d.source === "EXTENSION" ? "GİB sayfasından aktarıldı" : "GİB (demo)"}</dd>
            </dl>
            {d.source === "MANUAL" ? (
              <button onClick={unmark} className="w-full rounded-lg bg-slate-100 py-2 font-semibold text-slate-700 hover:bg-slate-200">
                İşareti geri al
              </button>
            ) : (
              <p className="text-xs text-slate-500">GİB&apos;den gelen kayıtlar elle silinemez.</p>
            )}
          </>
        ) : (
          <form onSubmit={mark} className="space-y-3">
            <p className="text-xs text-slate-500">
              GİB bağlantısı olmadan verilen beyannameleri buradan elle işaretleyebilirsiniz. Daha sonra GİB&apos;den
              gelen kayıt elle girilenin üzerine yazmaz.
            </p>
            <label className="block">
              <span className="font-medium">Verilme tarihi</span>
              <input type="date" required value={filedAt} onChange={(e) => setFiledAt(e.target.value)} className={`mt-1 ${input}`} />
            </label>
            <label className="block">
              <span className="font-medium">Tahakkuk tutarı (TL, isteğe bağlı)</span>
              <input inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} className={`mt-1 ${input}`} />
            </label>
            <input placeholder="Not (isteğe bağlı)" value={note} onChange={(e) => setNote(e.target.value)} className={input} />
            <button className="w-full rounded-lg bg-violet-600 py-2 font-semibold text-white hover:bg-violet-700">
              Verildi olarak işaretle
            </button>
          </form>
        )}
        {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-red-700">{error}</p>}
      </div>
    </Modal>
  );
}

function ObligationsModal({
  company,
  onClose,
  onSaved,
}: {
  company: Row["company"];
  onClose: () => void;
  onSaved: () => void;
}) {
  const [items, setItems] = useState<{ type: DeclarationType; label: string; active: boolean }[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api<{ items: { type: DeclarationType; label: string; active: boolean }[] }>(`/companies/${company.id}/obligations`)
      .then((r) => setItems(r.items))
      .catch((e) => setError(e.message));
  }, [company.id]);

  async function save() {
    if (!items) return;
    try {
      await api(`/companies/${company.id}/obligations`, {
        method: "PUT",
        body: JSON.stringify({ active: items.filter((i) => i.active).map((i) => i.type) }),
      });
      onSaved();
    } catch (err) {
      setError((err as Error).message);
    }
  }

  return (
    <Modal title="Beyanname yükümlülükleri" onClose={onClose}>
      <div className="space-y-3 text-sm">
        <p className="text-slate-600">
          {company.title} · {companyTypeLabel[company.type]}
        </p>
        {items?.map((i) => (
          <label key={i.type} className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={i.active}
              onChange={(e) => setItems(items.map((x) => (x.type === i.type ? { ...x, active: e.target.checked } : x)))}
            />
            {i.label}
          </label>
        ))}
        <p className="text-xs text-slate-500">
          Varsayılanlar firma türüne göre gelir. Örneğin işçi çalıştırmayan firmada MUHSGK&apos;yı kapatın.
        </p>
        {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-red-700">{error}</p>}
        <button onClick={save} disabled={!items} className="w-full rounded-lg bg-violet-600 py-2 font-semibold text-white hover:bg-violet-700 disabled:opacity-60">
          Kaydet
        </button>
      </div>
    </Modal>
  );
}
