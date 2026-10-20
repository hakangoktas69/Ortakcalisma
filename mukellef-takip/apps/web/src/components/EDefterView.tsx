"use client";

import { useCallback, useEffect, useState } from "react";
import { CalendarClock, Download, Settings2, X } from "lucide-react";
import { api, companyTypeLabel, downloadFile, formatDate, type BeratStatus, type CompanyType, type EDefterControl } from "@/lib/api";
import { StatusBadge } from "./StatusBars";

type Row = EDefterControl["rows"][number];

function defaultMonth() {
  // Bildirimden gelinmişse o ayı aç; yoksa son günü bu aya denk gelen dönem (4 ay önce)
  const m = typeof window !== "undefined" ? new URLSearchParams(window.location.search).get("month") : null;
  if (m && /^\d{4}-\d{2}$/.test(m)) return m;
  const d = new Date();
  d.setDate(1);
  d.setMonth(d.getMonth() - 4);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

const toInputDate = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString("sv-SE") : "");
const endOfDayIso = (ymd: string) => new Date(`${ymd}T23:59:59`).toISOString();

function BeratBadge({ status }: { status: BeratStatus }) {
  if (status === "NO_DATE")
    return (
      <span className="inline-flex items-center gap-1 text-xs text-slate-700">
        <CalendarClock size={14} color="#64748b" aria-hidden /> Son gün girilmeli
      </span>
    );
  return <StatusBadge status={status} />;
}

function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-30 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-white p-5 shadow-xl" onClick={(e) => e.stopPropagation()}>
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

export default function EDefterView() {
  const [month, setMonth] = useState(defaultMonth);
  const [data, setData] = useState<EDefterControl | null>(null);
  const [onlyOpen, setOnlyOpen] = useState(false);
  const [msg, setMsg] = useState<{ kind: "ok" | "err"; text: string } | null>(null);
  const [editing, setEditing] = useState<Row | null>(null);
  const [showSettings, setShowSettings] = useState(false);

  const load = useCallback(
    (isAlive: () => boolean = () => true) =>
      api<EDefterControl>(`/edefter/control?month=${month}`).then((d) => {
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

  const rows = data?.rows.filter((r) => !onlyOpen || r.status === "PENDING" || r.status === "LATE" || r.status === "NO_DATE") ?? [];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold">e-Defter berat takibi</h1>
          <p className="text-xs text-slate-500">
            {data ? `${data.monthLabel} · ${data.enabledCompanies} firma e-Defter kullanıyor` : "…"}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <input
            type="month"
            value={month}
            onChange={(e) => e.target.value && setMonth(e.target.value)}
            className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
            aria-label="Berat dönemi ayı"
          />
          <button
            onClick={() => downloadFile(`/reports/edefter?month=${month}`).catch((e) => setMsg({ kind: "err", text: e.message }))}
            className="flex items-center gap-2 rounded-lg bg-white px-3 py-2 text-sm font-semibold text-slate-700 ring-1 ring-slate-200 hover:bg-slate-50"
          >
            <Download size={16} /> Excel
          </button>
          <button
            onClick={() => setShowSettings(true)}
            className="flex items-center gap-2 rounded-lg bg-white px-3 py-2 text-sm font-semibold text-slate-700 ring-1 ring-slate-200 hover:bg-slate-50"
          >
            <Settings2 size={16} /> Firmalar
          </button>
        </div>
      </div>

      <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
        Son günler genel kurala göre hesaplanır: aylık yüklemede ilgili ayı izleyen 4. ayın 10&apos;u (gelir vergisi) /
        14&apos;ü (kurumlar vergisi); geçici vergi dönemi bazında dönem sonunu izleyen 2. ayın 10&apos;u / 14&apos;ü.
        Ekim–Aralık dönemi için tarih üretilmez. GİB süre uzatımlarında son günü satırdan düzeltin.
      </p>
      {msg && (
        <p className={`rounded-lg px-3 py-2 text-sm ${msg.kind === "ok" ? "bg-emerald-50 text-emerald-800" : "bg-red-50 text-red-700"}`}>
          {msg.text}
        </p>
      )}

      {data && (
        <div className="flex flex-wrap items-center gap-x-5 gap-y-2 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm">
          {(["FILED", "FILED_LATE", "PENDING", "LATE", "NO_DATE"] as BeratStatus[]).map((s) => (
            <span key={s} className="flex items-center gap-1.5">
              <BeratBadge status={s} /> <b className="tabular-nums">{data.counts[s]}</b>
            </span>
          ))}
          {data.skipped > 0 && <span className="text-xs text-slate-500">{data.skipped} firma bu ay yüklemiyor (dönemsel)</span>}
          <label className="ml-auto flex items-center gap-2 text-sm">
            <input type="checkbox" checked={onlyOpen} onChange={(e) => setOnlyOpen(e.target.checked)} /> Sadece eksikler
          </label>
        </div>
      )}

      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500">
            <tr>
              <th className="px-4 py-3">Firma</th>
              <th className="px-4 py-3">Dönem</th>
              <th className="px-4 py-3">Son gün</th>
              <th className="px-4 py-3">Durum</th>
              <th className="px-4 py-3">Yükleme</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {rows.map((r) => (
              <tr key={r.company.id} className="hover:bg-slate-50">
                <td className="px-4 py-2.5">
                  <p className="font-medium">{r.company.title}</p>
                  <p className="text-xs text-slate-500">
                    {companyTypeLabel[r.company.type]} · {r.company.preference === "MONTHLY" ? "aylık" : "geçici vergi dönemi"}
                  </p>
                </td>
                <td className="px-4 py-2.5 whitespace-nowrap">{r.periodLabel}</td>
                <td className="px-4 py-2.5 whitespace-nowrap">
                  {formatDate(r.dueDate)}
                  {r.dueDateSource === "override" && <span className="ml-1 rounded bg-slate-100 px-1 text-[10px] text-slate-600">elle</span>}
                </td>
                <td className="px-4 py-2.5">
                  <BeratBadge status={r.status} />
                  {r.note && <p className="max-w-56 truncate text-xs text-slate-500" title={r.note}>{r.note}</p>}
                </td>
                <td className="px-4 py-2.5 whitespace-nowrap">{formatDate(r.uploadedAt)}</td>
                <td className="px-4 py-2.5 text-right">
                  <button onClick={() => setEditing(r)} className="rounded-lg px-2 py-1 text-xs font-semibold text-sky-700 hover:bg-sky-50">
                    Düzenle
                  </button>
                </td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-slate-500">
                  {data?.enabledCompanies === 0 ? "e-Defter kullanan firma yok. \"Firmalar\" düğmesinden seçin." : "Kayıt yok"}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {editing && (
        <BeratModal
          row={editing}
          onClose={() => setEditing(null)}
          onSaved={(text) => {
            setEditing(null);
            setMsg({ kind: "ok", text });
            load();
          }}
        />
      )}
      {showSettings && (
        <SettingsModal
          onClose={() => {
            setShowSettings(false);
            load();
          }}
        />
      )}
    </div>
  );
}

function BeratModal({ row, onClose, onSaved }: { row: Row; onClose: () => void; onSaved: (msg: string) => void }) {
  const [uploaded, setUploaded] = useState(!!row.uploadedAt);
  const [uploadedAt, setUploadedAt] = useState(toInputDate(row.uploadedAt) || new Date().toLocaleDateString("sv-SE"));
  const [override, setOverride] = useState(row.dueDateSource === "override" ? toInputDate(row.dueDate) : "");
  const [note, setNote] = useState(row.note ?? "");
  const [error, setError] = useState<string | null>(null);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      await api(`/edefter/companies/${row.company.id}/berats/${row.period}`, {
        method: "PUT",
        body: JSON.stringify({
          uploadedAt: uploaded ? new Date(`${uploadedAt}T12:00:00`).toISOString() : null,
          dueDateOverride: override ? endOfDayIso(override) : null,
          note: note.trim() || null,
        }),
      });
      onSaved(`${row.company.title} · ${row.periodLabel} güncellendi.`);
    } catch (err) {
      setError((err as Error).message);
    }
  }

  return (
    <Modal title={`${row.company.title} · ${row.periodLabel}`} onClose={onClose}>
      <form onSubmit={save} className="space-y-3 text-sm">
        <label className="flex items-center gap-2">
          <input type="checkbox" checked={uploaded} onChange={(e) => setUploaded(e.target.checked)} /> Berat yüklendi
        </label>
        {uploaded && (
          <label className="block">
            <span className="font-medium">Yükleme tarihi</span>
            <input type="date" required value={uploadedAt} onChange={(e) => setUploadedAt(e.target.value)} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2" />
          </label>
        )}
        <label className="block">
          <span className="font-medium">Son gün (elle)</span>
          <input type="date" value={override} onChange={(e) => setOverride(e.target.value)} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2" />
          <span className="text-xs text-slate-500">
            Boş bırakılırsa kural tarihi kullanılır{row.dueDateSource !== "none" && row.dueDateSource !== "override" ? ` (${formatDate(row.dueDate)})` : ""}.
            GİB süre uzatımı veya Ekim–Aralık dönemi için doldurun.
          </span>
        </label>
        <input placeholder="Not (ör. VUK sirküleri no)" value={note} onChange={(e) => setNote(e.target.value)} className="w-full rounded-lg border border-slate-300 px-3 py-2" />
        {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-red-700">{error}</p>}
        <button className="w-full rounded-lg bg-sky-600 py-2 font-semibold text-white hover:bg-sky-700">Kaydet</button>
      </form>
    </Modal>
  );
}

interface EDefterCompany {
  id: string;
  title: string;
  taxNumber: string;
  type: CompanyType;
  eDefterEnabled: boolean;
  eDefterPreference: "MONTHLY" | "QUARTERLY";
}

function SettingsModal({ onClose }: { onClose: () => void }) {
  const [items, setItems] = useState<EDefterCompany[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api<EDefterCompany[]>("/edefter/companies").then(setItems).catch((e) => setError(e.message));
  }, []);

  async function update(c: EDefterCompany, patch: Partial<Pick<EDefterCompany, "eDefterEnabled" | "eDefterPreference">>) {
    const next = { ...c, ...patch };
    setItems((list) => list?.map((x) => (x.id === c.id ? next : x)) ?? null);
    try {
      await api(`/edefter/companies/${c.id}`, {
        method: "PUT",
        body: JSON.stringify({ enabled: next.eDefterEnabled, preference: next.eDefterPreference }),
      });
    } catch (err) {
      setError((err as Error).message);
      setItems((list) => list?.map((x) => (x.id === c.id ? c : x)) ?? null);
    }
  }

  return (
    <Modal title="e-Defter kullanan firmalar" onClose={onClose}>
      <p className="mb-3 text-xs text-slate-500">
        Yükleme tercihi GİB e-Defter uygulamasındaki &quot;Berat Yükleme Tercihi&quot; ile aynı olmalı.
      </p>
      {error && <p className="mb-2 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
      <ul className="divide-y divide-slate-100 text-sm">
        {items?.map((c) => (
          <li key={c.id} className="flex flex-wrap items-center gap-2 py-2">
            <label className="flex min-w-0 flex-1 items-center gap-2">
              <input type="checkbox" checked={c.eDefterEnabled} onChange={(e) => update(c, { eDefterEnabled: e.target.checked })} />
              <span className="truncate">{c.title}</span>
            </label>
            <select
              value={c.eDefterPreference}
              disabled={!c.eDefterEnabled}
              onChange={(e) => update(c, { eDefterPreference: e.target.value as EDefterCompany["eDefterPreference"] })}
              className="rounded-lg border border-slate-300 px-2 py-1 text-xs disabled:opacity-50"
            >
              <option value="MONTHLY">Aylık</option>
              <option value="QUARTERLY">Geçici vergi dönemi</option>
            </select>
          </li>
        ))}
      </ul>
    </Modal>
  );
}
