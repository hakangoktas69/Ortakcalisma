"use client";

import { useCallback, useEffect, useState } from "react";
import { AlertTriangle, CheckCircle2, CircleHelp, Download, Trash2, Upload, X } from "lucide-react";
import {
  api,
  apiUpload,
  downloadFile,
  type Company,
  type PayrollImportResult,
  type PayrollLine,
  type PayrollReconciliation,
  type PayrollRunSummary,
  type SgkWorkplace,
} from "@/lib/api";

const tl = (n: number | null) => (n === null ? "—" : n.toLocaleString("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }));
const maskTckn = (t: string) => `${t.slice(0, 3)}*****${t.slice(-3)}`;

function previousMonth() {
  const d = new Date();
  d.setDate(1);
  d.setMonth(d.getMonth() - 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function StatusBadge({ r }: { r: PayrollReconciliation }) {
  if (r.status === "OK")
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-semibold text-emerald-800">
        <CheckCircle2 size={12} /> e-Bildirge ile uyumlu
      </span>
    );
  if (r.status === "MISMATCH")
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-red-100 px-2.5 py-0.5 text-xs font-semibold text-red-800" title={r.diffs.join("\n")}>
        <AlertTriangle size={12} /> {r.diffs.length} fark
      </span>
    );
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-semibold text-slate-600">
      <CircleHelp size={12} /> e-Bildirge yok
    </span>
  );
}

function ReconTable({ totals, r }: { totals: { employeeCount: number; totalDays: number; sgkBase: number }; r: PayrollReconciliation }) {
  const rows: [string, string, string, boolean][] = [
    ["Sigortalı sayısı", String(totals.employeeCount), r.ebildirge ? String(r.ebildirge.insuredCount) : "—", !!r.ebildirge && r.ebildirge.insuredCount !== totals.employeeCount],
    ["Prim günü", String(totals.totalDays), r.ebildirge ? String(r.ebildirge.totalDays) : "—", !!r.ebildirge && r.ebildirge.totalDays !== totals.totalDays],
    ["PEK (SGK matrahı)", tl(totals.sgkBase), r.ebildirge ? tl(r.ebildirge.premiumBase) : "—", !!r.ebildirge && Math.abs(r.ebildirge.premiumBase - totals.sgkBase) > 1],
  ];
  return (
    <table className="w-full max-w-lg text-sm">
      <thead className="text-left text-xs text-slate-500">
        <tr>
          <th className="py-1" />
          <th className="py-1 text-right">Bordro</th>
          <th className="py-1 text-right">e-Bildirge{r.ebildirge ? ` (${r.ebildirge.documents} belge)` : ""}</th>
        </tr>
      </thead>
      <tbody className="divide-y divide-slate-100">
        {rows.map(([l, a, b, bad]) => (
          <tr key={l} className={bad ? "text-red-700" : ""}>
            <td className="py-1">{l}</td>
            <td className="py-1 text-right tabular-nums">{a}</td>
            <td className="py-1 text-right tabular-nums">{b}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function ImportModal({ period, onClose, onDone }: { period: string; onClose: () => void; onDone: (msg: string) => void }) {
  const [companies, setCompanies] = useState<Company[]>([]);
  const [workplaces, setWorkplaces] = useState<SgkWorkplace[]>([]);
  const [companyId, setCompanyId] = useState("");
  const [workplaceId, setWorkplaceId] = useState("");
  const [p, setP] = useState(period);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<PayrollImportResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    Promise.all([api<Company[]>("/companies"), api<{ items: SgkWorkplace[] }>("/sgk/workplaces")])
      .then(([c, w]) => {
        if (!alive) return;
        setCompanies(c.filter((x) => x.isActive));
        setWorkplaces(w.items);
      })
      .catch((e) => alive && setError(e.message));
    return () => {
      alive = false;
    };
  }, []);

  const companyWorkplaces = workplaces.filter((w) => w.company.id === companyId);
  const fields = () => ({ companyId, period: p, ...(workplaceId ? { workplaceId } : {}) });

  async function check(f: File | null = file) {
    setPreview(null);
    setError(null);
    if (!f || !companyId) return;
    setBusy(true);
    try {
      setPreview(await apiUpload<PayrollImportResult>("/payroll/import?dryRun=true", "file", [f], fields()));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function commit() {
    if (!file) return;
    setBusy(true);
    try {
      const r = await apiUpload<PayrollImportResult>("/payroll/import?dryRun=false", "file", [file], fields());
      onDone(`${r.company.title} · ${r.period.slice(5)}/${r.period.slice(0, 4)} bordrosu kaydedildi (${r.totals.employeeCount} personel).`);
    } catch (e) {
      setError((e as Error).message);
      setBusy(false);
    }
  }

  const input = "w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-brand-500";

  return (
    <div className="fixed inset-0 z-30 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-white p-5 shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="font-bold">Bordro yükle</h2>
          <button onClick={onClose} className="rounded p-1 text-slate-500 hover:bg-slate-100" aria-label="Kapat">
            <X size={18} />
          </button>
        </div>
        <p className="mb-3 text-sm text-slate-600">
          Bordro programınızdan personel bazlı bordro listesini Excel (.xlsx) veya CSV olarak alın. Sütun adları programdan programa
          değişse de çoğu durumda tanınır; zorunlu olanlar <b>T.C. Kimlik No</b>, <b>Gün</b> ve <b>SGK Matrahı</b>.{" "}
          <button onClick={() => downloadFile("/payroll/template").catch((e) => setError(e.message))} className="inline-flex items-center gap-1 text-brand-700 hover:underline">
            <Download size={13} /> Örnek şablon
          </button>
        </p>
        <div className="grid gap-3 sm:grid-cols-3">
          <label className="text-sm sm:col-span-2">
            <span className="mb-1 block text-slate-600">Firma</span>
            <select
              value={companyId}
              onChange={(e) => {
                setCompanyId(e.target.value);
                setWorkplaceId("");
                setPreview(null);
              }}
              className={input}
            >
              <option value="">Seçin</option>
              {companies.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.title}
                </option>
              ))}
            </select>
          </label>
          <label className="text-sm">
            <span className="mb-1 block text-slate-600">Dönem</span>
            <input type="month" value={p} onChange={(e) => e.target.value && setP(e.target.value)} className={input} />
          </label>
          {companyWorkplaces.length > 1 && (
            <label className="text-sm sm:col-span-3">
              <span className="mb-1 block text-slate-600">SGK işyeri</span>
              <select value={workplaceId} onChange={(e) => setWorkplaceId(e.target.value)} className={input}>
                <option value="">Tüm işyerleri (birleşik bordro)</option>
                {companyWorkplaces.map((w) => (
                  <option key={w.id} value={w.id}>
                    {w.name ?? "İşyeri"} · {w.registryNo}
                  </option>
                ))}
              </select>
            </label>
          )}
        </div>
        <label
          className={`mt-3 flex flex-col items-center gap-2 rounded-xl border-2 border-dashed px-4 py-5 text-sm ${
            companyId ? "cursor-pointer border-slate-300 text-slate-600 hover:border-brand-400 hover:bg-brand-50" : "cursor-not-allowed border-slate-200 text-slate-400"
          }`}
        >
          <Upload size={20} />
          {file ? file.name : companyId ? ".xlsx veya .csv dosyası seçin (en fazla 5 MB)" : "Önce firmayı seçin"}
          <input
            type="file"
            accept=".xlsx,.csv"
            className="hidden"
            disabled={!companyId}
            onChange={(e) => {
              const f = e.target.files?.[0] ?? null;
              setFile(f);
              check(f);
            }}
          />
        </label>
        {file && companyId && !busy && !preview && (
          <button onClick={() => check()} className="mt-2 text-sm text-brand-700 hover:underline">
            Önizlemeyi yenile
          </button>
        )}

        {busy && !preview && <p className="mt-3 text-sm text-slate-500">Dosya okunuyor…</p>}
        {error && <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

        {preview && (
          <div className="mt-4 space-y-3 text-sm">
            <p className="text-slate-600">
              {preview.company.title}
              {preview.workplace ? ` · ${preview.workplace.name ?? ""} ${preview.workplace.registryNo}` : ""} · {preview.totals.employeeCount} personel ·
              başlık satırı {preview.headerRow}
            </p>
            {preview.replaces && (
              <p className="rounded-lg bg-amber-50 px-3 py-2 text-amber-800">
                Bu dönem için kayıtlı bordro ({preview.replaces.employeeCount} personel) bu dosyayla değiştirilecek.
              </p>
            )}
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {[
                ["Brüt", tl(preview.totals.gross)],
                ["SGK matrahı", tl(preview.totals.sgkBase)],
                ["Gelir + damga v.", tl(preview.totals.incomeTax + preview.totals.stampTax)],
                ["Net", tl(preview.totals.net)],
              ].map(([l, v]) => (
                <div key={l} className="rounded-lg bg-slate-50 px-3 py-2">
                  <p className="text-xs text-slate-500">{l}</p>
                  <p className="font-bold tabular-nums">{v}</p>
                </div>
              ))}
            </div>
            <div className="rounded-xl border border-slate-200 p-3">
              <div className="mb-2 flex items-center justify-between">
                <p className="font-semibold">e-Bildirge mutabakatı</p>
                <StatusBadge r={preview.reconciliation} />
              </div>
              <ReconTable totals={preview.totals} r={preview.reconciliation} />
            </div>
            {preview.warnings.length > 0 && (
              <details className="rounded-lg bg-amber-50 px-3 py-2 text-amber-800" open>
                <summary className="cursor-pointer">{preview.totals.warningCount} personelde kontrol uyarısı</summary>
                <ul className="mt-1 list-disc pl-5 text-xs">
                  {preview.warnings.map((w) => (
                    <li key={w.row}>
                      Satır {w.row} · {w.fullName}: {w.warnings.join("; ")}
                    </li>
                  ))}
                </ul>
              </details>
            )}
            {preview.errorCount > 0 && (
              <details className="rounded-lg bg-red-50 px-3 py-2 text-red-800">
                <summary className="cursor-pointer">{preview.errorCount} satır okunamadı (aktarılmayacak)</summary>
                <ul className="mt-1 list-disc pl-5 text-xs">
                  {preview.errors.map((e) => (
                    <li key={`${e.row}-${e.message}`}>
                      Satır {e.row}: {e.message}
                    </li>
                  ))}
                </ul>
              </details>
            )}
            <div className="flex justify-end gap-2">
              <button onClick={onClose} className="rounded-lg px-4 py-2 text-sm text-slate-600 hover:bg-slate-100">
                Vazgeç
              </button>
              <button onClick={commit} disabled={busy} className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-60">
                {busy ? "Kaydediliyor…" : preview.replaces ? "Değiştir ve kaydet" : "Kaydet"}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function RunDetail({ id, onClose, onDeleted }: { id: string; onClose: () => void; onDeleted: () => void }) {
  const [run, setRun] = useState<(PayrollRunSummary & { lines: PayrollLine[] }) | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [onlyWarnings, setOnlyWarnings] = useState(false);

  useEffect(() => {
    let alive = true;
    api<PayrollRunSummary & { lines: PayrollLine[] }>(`/payroll/runs/${id}`)
      .then((r) => alive && setRun(r))
      .catch((e) => alive && setError(e.message));
    return () => {
      alive = false;
    };
  }, [id]);

  async function remove() {
    if (!run || !confirm(`${run.company.title} · ${run.period} bordrosu silinsin mi?`)) return;
    try {
      await api(`/payroll/runs/${id}`, { method: "DELETE" });
      onDeleted();
    } catch (e) {
      setError((e as Error).message);
    }
  }

  if (error) return <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>;
  if (!run) return <p className="text-sm text-slate-500">Yükleniyor…</p>;
  const lines = onlyWarnings ? run.lines.filter((l) => l.warnings.length) : run.lines;

  return (
    <div className="space-y-3 rounded-xl border border-brand-200 bg-brand-50/40 p-4">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="font-bold">{run.company.title}</p>
          <p className="text-xs text-slate-500">
            {run.workplace ? `${run.workplace.name ?? "İşyeri"} · ${run.workplace.registryNo} · ` : ""}
            {run.period.slice(5)}/{run.period.slice(0, 4)} · {run.fileName ?? ""} {run.source === "DEMO" ? "(demo)" : ""}
          </p>
        </div>
        <div className="flex items-center gap-1">
          <button onClick={remove} className="rounded p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600" aria-label="Bordroyu sil">
            <Trash2 size={15} />
          </button>
          <button onClick={onClose} className="rounded p-1 text-slate-500 hover:bg-white" aria-label="Kapat">
            <X size={16} />
          </button>
        </div>
      </div>
      <div className="flex flex-wrap items-start gap-6">
        <ReconTable totals={run} r={run.reconciliation} />
        {run.reconciliation.diffs.length > 0 && (
          <ul className="list-disc pl-5 text-sm text-red-700">
            {run.reconciliation.diffs.map((d) => (
              <li key={d}>{d}</li>
            ))}
          </ul>
        )}
      </div>
      {run.warningCount > 0 && (
        <label className="flex items-center gap-2 text-sm text-amber-800">
          <input type="checkbox" checked={onlyWarnings} onChange={(e) => setOnlyWarnings(e.target.checked)} />
          Sadece uyarılı personeli göster ({run.warningCount})
        </label>
      )}
      <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500">
            <tr>
              <th className="px-3 py-2">Personel</th>
              <th className="px-3 py-2 text-right">Gün</th>
              <th className="px-3 py-2 text-right">Brüt</th>
              <th className="px-3 py-2 text-right">SGK matrahı</th>
              <th className="px-3 py-2 text-right">SGK + işsizlik (işçi)</th>
              <th className="px-3 py-2 text-right">GV</th>
              <th className="px-3 py-2 text-right">DV</th>
              <th className="px-3 py-2 text-right">Net</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {lines.map((l) => (
              <tr key={l.id} className={l.warnings.length ? "bg-amber-50" : ""}>
                <td className="px-3 py-1.5">
                  <p>{l.fullName || "—"}</p>
                  <p className="font-mono text-xs text-slate-500">{maskTckn(l.tckn)}</p>
                  {l.warnings.map((w) => (
                    <p key={w} className="text-xs text-amber-800">
                      {w}
                    </p>
                  ))}
                </td>
                <td className="px-3 py-1.5 text-right tabular-nums">{l.days}</td>
                <td className="px-3 py-1.5 text-right tabular-nums">{tl(l.gross)}</td>
                <td className="px-3 py-1.5 text-right tabular-nums">{tl(l.sgkBase)}</td>
                <td className="px-3 py-1.5 text-right tabular-nums">{tl(l.employeeSgk + l.employeeUnemployment)}</td>
                <td className="px-3 py-1.5 text-right tabular-nums">{tl(l.incomeTax)}</td>
                <td className="px-3 py-1.5 text-right tabular-nums">{tl(l.stampTax)}</td>
                <td className="px-3 py-1.5 text-right tabular-nums">{tl(l.net)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default function PayrollView() {
  const [period, setPeriod] = useState(previousMonth);
  const [items, setItems] = useState<PayrollRunSummary[]>([]);
  const [missing, setMissing] = useState<{ id: string; registryNo: string; name: string | null; company: { id: string; title: string } }[]>([]);
  const [detailId, setDetailId] = useState<string | null>(null);
  const [importing, setImporting] = useState(false);
  const [msg, setMsg] = useState<{ kind: "ok" | "err"; text: string } | null>(null);

  const load = useCallback(
    (isAlive: () => boolean = () => true) =>
      api<{ items: PayrollRunSummary[]; missing: typeof missing }>(`/payroll/overview?period=${period}`).then((o) => {
        if (!isAlive()) return;
        setItems(o.items);
        setMissing(o.missing);
      }),
    [period],
  );

  useEffect(() => {
    let alive = true;
    load(() => alive).catch((e) => alive && setMsg({ kind: "err", text: e.message }));
    return () => {
      alive = false;
    };
  }, [load]);

  const mismatches = items.filter((i) => i.reconciliation.status === "MISMATCH").length;
  const sum = (f: (i: PayrollRunSummary) => number) => items.reduce((s, i) => s + f(i), 0);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold">Bordro</h1>
          <p className="text-xs text-slate-500">Bordro programının çıktısı · e-Bildirge mutabakatı · Portal bordro hesaplamaz</p>
        </div>
        <div className="flex items-center gap-2">
          <input
            type="month"
            value={period}
            onChange={(e) => {
              if (!e.target.value) return;
              setPeriod(e.target.value);
              setDetailId(null);
            }}
            className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm"
            aria-label="Dönem"
          />
          <button
            onClick={() => setImporting(true)}
            className="flex items-center gap-2 rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700"
          >
            <Upload size={16} /> Bordro yükle
          </button>
        </div>
      </div>

      {msg && (
        <p className={`rounded-lg px-3 py-2 text-sm ${msg.kind === "ok" ? "bg-emerald-50 text-emerald-800" : "bg-red-50 text-red-700"}`}>{msg.text}</p>
      )}
      {mismatches > 0 && (
        <p className="flex items-center gap-2 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
          <AlertTriangle size={16} /> {mismatches} bordro e-Bildirge ile uyuşmuyor. Satıra tıklayıp farkları görün.
        </p>
      )}
      {missing.length > 0 && (
        <p className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800">
          e-Bildirge&apos;si verilmiş ama bordrosu yüklenmemiş {missing.length} işyeri:{" "}
          {missing
            .slice(0, 5)
            .map((m) => m.company.title)
            .join(", ")}
          {missing.length > 5 ? "…" : ""}
        </p>
      )}

      {detailId && (
        <RunDetail
          key={detailId}
          id={detailId}
          onClose={() => setDetailId(null)}
          onDeleted={() => {
            setDetailId(null);
            load().catch(() => {});
          }}
        />
      )}

      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500">
            <tr>
              <th className="px-4 py-3">Firma / işyeri</th>
              <th className="px-4 py-3 text-right">Personel</th>
              <th className="px-4 py-3 text-right">Gün</th>
              <th className="px-4 py-3 text-right">Brüt</th>
              <th className="px-4 py-3 text-right">SGK matrahı</th>
              <th className="px-4 py-3 text-right">GV + DV</th>
              <th className="px-4 py-3 text-right">Net</th>
              <th className="px-4 py-3">Kontrol</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {items.map((i) => (
              <tr key={i.id} onClick={() => setDetailId(i.id)} className={`cursor-pointer hover:bg-slate-50 ${detailId === i.id ? "bg-brand-50" : ""}`}>
                <td className="min-w-48 px-4 py-2.5">
                  <p className="font-medium">{i.company.title}</p>
                  <p className="font-mono text-xs text-slate-500">{i.workplace ? i.workplace.registryNo : "Tüm işyerleri"}</p>
                </td>
                <td className="px-4 py-2.5 text-right tabular-nums">{i.employeeCount}</td>
                <td className="px-4 py-2.5 text-right tabular-nums">{i.totalDays}</td>
                <td className="px-4 py-2.5 text-right tabular-nums">{tl(i.gross)}</td>
                <td className="px-4 py-2.5 text-right tabular-nums">{tl(i.sgkBase)}</td>
                <td className="px-4 py-2.5 text-right tabular-nums">{tl(i.incomeTax + i.stampTax)}</td>
                <td className="px-4 py-2.5 text-right tabular-nums">{tl(i.net)}</td>
                <td className="px-4 py-2.5">
                  <div className="flex flex-wrap items-center gap-1">
                    <StatusBadge r={i.reconciliation} />
                    {i.warningCount > 0 && (
                      <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-800">{i.warningCount} uyarı</span>
                    )}
                  </div>
                </td>
              </tr>
            ))}
            {items.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-4 py-8 text-center text-slate-500">
                  Bu dönem için bordro yok. Bordro programınızın Excel çıktısını &quot;Bordro yükle&quot; ile aktarın.
                </td>
              </tr>
            ) : (
              <tr className="bg-slate-50 font-semibold">
                <td className="px-4 py-2.5">Toplam ({items.length} bordro)</td>
                <td className="px-4 py-2.5 text-right tabular-nums">{sum((i) => i.employeeCount)}</td>
                <td className="px-4 py-2.5 text-right tabular-nums">{sum((i) => i.totalDays)}</td>
                <td className="px-4 py-2.5 text-right tabular-nums">{tl(sum((i) => i.gross))}</td>
                <td className="px-4 py-2.5 text-right tabular-nums">{tl(sum((i) => i.sgkBase))}</td>
                <td className="px-4 py-2.5 text-right tabular-nums">{tl(sum((i) => i.incomeTax + i.stampTax))}</td>
                <td className="px-4 py-2.5 text-right tabular-nums">{tl(sum((i) => i.net))}</td>
                <td />
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-slate-500">
        Mutabakat: bordrodaki personel sayısı, prim günü ve SGK matrahı aynı dönemin e-Bildirge belgeleriyle (asıl + ek − iptal)
        karşılaştırılır. Satır kontrolleri kanunla sabit oranlara dayanır: SGK işçi payı %14, işsizlik işçi payı %1, en fazla 30 gün.
      </p>

      {importing && (
        <ImportModal
          period={period}
          onClose={() => setImporting(false)}
          onDone={(text) => {
            setImporting(false);
            setMsg({ kind: "ok", text });
            load().catch(() => {});
          }}
        />
      )}
    </div>
  );
}
