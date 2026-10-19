"use client";

import { useCallback, useEffect, useState } from "react";
import { AlertTriangle, ArrowDownLeft, ArrowUpRight, Trash2, Upload, X } from "lucide-react";
import {
  api,
  apiUpload,
  formatDate,
  type Company,
  type InvoiceDirection,
  type InvoiceImportResult,
  type InvoiceKdv,
  type InvoiceOverviewRow,
  type InvoiceRow,
} from "@/lib/api";

type Tab = "kdv" | "liste";

const tl = (n: number) => n.toLocaleString("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const money = (n: number, cur = "TRY") => (cur === "TRY" ? `${tl(n)} ₺` : `${tl(n)} ${cur}`);

function previousMonth() {
  const d = new Date();
  d.setDate(1);
  d.setMonth(d.getMonth() - 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

const TYPE_LABEL: Record<string, string> = {
  SATIS: "Satış",
  IADE: "İade",
  TEVKIFAT: "Tevkifat",
  ISTISNA: "İstisna",
  OZELMATRAH: "Özel matrah",
  IHRACKAYITLI: "İhraç kayıtlı",
};
const PROFILE_LABEL: Record<string, string> = {
  TEMELFATURA: "e-Fatura (temel)",
  TICARIFATURA: "e-Fatura (ticari)",
  EARSIVFATURA: "e-Arşiv",
  IHRACAT: "İhracat",
  KAMU: "Kamu",
};

function ImportModal({ onClose, onDone }: { onClose: () => void; onDone: (msg: string) => void }) {
  const [files, setFiles] = useState<File[]>([]);
  const [preview, setPreview] = useState<InvoiceImportResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function check(list: File[]) {
    setFiles(list);
    setPreview(null);
    setError(null);
    if (!list.length) return;
    setBusy(true);
    try {
      setPreview(await apiUpload<InvoiceImportResult>("/invoices/import?dryRun=true", "files", list));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function commit() {
    setBusy(true);
    setError(null);
    try {
      const r = await apiUpload<InvoiceImportResult>("/invoices/import?dryRun=false", "files", files);
      onDone(`${r.create} fatura aktarıldı${r.duplicate ? `, ${r.duplicate} tanesi zaten kayıtlıydı` : ""}.`);
    } catch (e) {
      setError((e as Error).message);
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-30 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-white p-5 shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="font-bold">Fatura yükle (UBL-TR XML / ZIP)</h2>
          <button onClick={onClose} className="rounded p-1 text-slate-500 hover:bg-slate-100" aria-label="Kapat">
            <X size={18} />
          </button>
        </div>
        <ol className="mb-4 list-decimal space-y-1 pl-5 text-sm text-slate-600">
          <li>Mükellefin e-Fatura / e-Arşiv entegratörünün portalında giden veya gelen faturaları seçin.</li>
          <li>&quot;XML (UBL) olarak indir&quot; ya da &quot;toplu indir (ZIP)&quot; seçeneğiyle indirin.</li>
          <li>Dosyaları buraya bırakın. Faturalar satıcı ve alıcı VKN&apos;sine göre portaldaki mükelleflerle eşleştirilir.</li>
        </ol>
        <label className="flex cursor-pointer flex-col items-center gap-2 rounded-xl border-2 border-dashed border-slate-300 px-4 py-6 text-sm text-slate-600 hover:border-brand-400 hover:bg-brand-50">
          <Upload size={20} />
          {files.length ? `${files.length} dosya seçildi` : ".xml veya .zip dosyaları seçin (birden fazla seçilebilir, toplam 25 MB)"}
          <input
            type="file"
            multiple
            accept=".xml,.zip"
            className="hidden"
            onChange={(e) => check(Array.from(e.target.files ?? []))}
          />
        </label>

        {busy && !preview && <p className="mt-3 text-sm text-slate-500">Dosyalar okunuyor…</p>}
        {error && <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

        {preview && (
          <div className="mt-4 space-y-3 text-sm">
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {[
                ["Okunan fatura", preview.recognized],
                ["Eklenecek", preview.create],
                ["Zaten kayıtlı", preview.duplicate],
                ["Eşleşmeyen", preview.unmatchedInvoices],
              ].map(([l, v]) => (
                <div key={l as string} className="rounded-lg bg-slate-50 px-3 py-2">
                  <p className="text-xs text-slate-500">{l}</p>
                  <p className="text-lg font-bold">{v}</p>
                </div>
              ))}
            </div>
            {preview.byCompany.length > 0 && (
              <table className="w-full text-sm">
                <thead className="text-left text-xs text-slate-500">
                  <tr>
                    <th className="py-1">Mükellef</th>
                    <th className="py-1 text-right">Satış</th>
                    <th className="py-1 text-right">Alış</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {preview.byCompany.map((b) => (
                    <tr key={b.companyId}>
                      <td className="py-1">{b.company}</td>
                      <td className="py-1 text-right tabular-nums">{b.outgoing}</td>
                      <td className="py-1 text-right tabular-nums">{b.incoming}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
            {preview.unmatched.length > 0 && (
              <p className="rounded-lg bg-amber-50 px-3 py-2 text-amber-800">
                Satıcısı veya alıcısı portalda kayıtlı olmayan {preview.unmatchedInvoices} fatura atlanacak. Görülen VKN&apos;ler:{" "}
                {preview.unmatched
                  .slice(0, 6)
                  .map((u) => `${u.name ?? "?"} (${u.taxNumber})`)
                  .join(", ")}
                {preview.unmatched.length > 6 ? "…" : ""}
              </p>
            )}
            {preview.foreignWithoutRate > 0 && (
              <p className="rounded-lg bg-amber-50 px-3 py-2 text-amber-800">
                {preview.foreignWithoutRate} dövizli faturada kur bilgisi yok; kaydedilir ama KDV ön kontrolüne dahil edilmez.
              </p>
            )}
            {(preview.errorCount > 0 || preview.skippedCount > 0) && (
              <details className="rounded-lg bg-red-50 px-3 py-2 text-red-800">
                <summary className="cursor-pointer">
                  {preview.errorCount} dosya fatura olarak okunamadı, {preview.skippedCount} dosya atlandı
                </summary>
                <ul className="mt-1 list-disc pl-5 text-xs">
                  {[...preview.errors.map((e) => `${e.name}: ${e.error}`), ...preview.skipped.map((s) => `${s.name}: ${s.reason}`)].map((t) => (
                    <li key={t}>{t}</li>
                  ))}
                </ul>
              </details>
            )}
            <div className="flex justify-end gap-2">
              <button onClick={onClose} className="rounded-lg px-4 py-2 text-sm text-slate-600 hover:bg-slate-100">
                Vazgeç
              </button>
              <button
                onClick={commit}
                disabled={busy || preview.create === 0}
                className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-60"
              >
                {busy ? "Aktarılıyor…" : `Aktar (${preview.create} fatura)`}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function Bucket({ title, b, vatLabel }: { title: string; b: InvoiceKdv["sales"]; vatLabel: string }) {
  return (
    <div className="rounded-xl border border-slate-200 p-3">
      <p className="mb-2 text-sm font-semibold">
        {title} <span className="font-normal text-slate-500">({b.count} fatura{b.returns ? `, ${b.returns} iade` : ""})</span>
      </p>
      <table className="w-full text-sm">
        <thead className="text-left text-xs text-slate-500">
          <tr>
            <th className="py-1">KDV oranı</th>
            <th className="py-1 text-right">Matrah</th>
            <th className="py-1 text-right">{vatLabel}</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {b.byRate.map((r) => (
            <tr key={r.rate}>
              <td className="py-1">%{r.rate}</td>
              <td className="py-1 text-right tabular-nums">{tl(r.base)}</td>
              <td className="py-1 text-right tabular-nums">{tl(r.vat)}</td>
            </tr>
          ))}
          <tr className="font-semibold">
            <td className="py-1">Toplam</td>
            <td className="py-1 text-right tabular-nums">{tl(b.base)}</td>
            <td className="py-1 text-right tabular-nums">{tl(b.vat)}</td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}

function KdvDetail({ companyId, period, onClose }: { companyId: string; period: string; onClose: () => void }) {
  const [data, setData] = useState<InvoiceKdv | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    api<InvoiceKdv>(`/invoices/kdv?companyId=${companyId}&period=${period}`)
      .then((d) => alive && setData(d))
      .catch((e) => alive && setError(e.message));
    return () => {
      alive = false;
    };
  }, [companyId, period]);

  if (error) return <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>;
  if (!data) return <p className="text-sm text-slate-500">Yükleniyor…</p>;

  return (
    <div className="space-y-3 rounded-xl border border-brand-200 bg-brand-50/40 p-4">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="font-bold">{data.company.title}</p>
          <p className="text-xs text-slate-500">
            VKN {data.company.taxNumber} · {data.period.slice(5)}/{data.period.slice(0, 4)} dönemi KDV ön kontrolü
          </p>
        </div>
        <button onClick={onClose} className="rounded p-1 text-slate-500 hover:bg-white" aria-label="Kapat">
          <X size={16} />
        </button>
      </div>
      <div className="grid gap-3 md:grid-cols-2">
        <Bucket title="Satışlar (kesilen)" b={data.sales} vatLabel="Hesaplanan KDV" />
        <Bucket title="Alışlar (gelen)" b={data.purchases} vatLabel="KDV" />
      </div>
      <table className="w-full max-w-md text-sm">
        <tbody>
          <tr>
            <td className="py-0.5">Hesaplanan KDV</td>
            <td className="py-0.5 text-right tabular-nums">{money(data.sales.vat)}</td>
          </tr>
          {data.sales.withholding > 0 && (
            <tr>
              <td className="py-0.5">− Alıcının tevkif ettiği KDV</td>
              <td className="py-0.5 text-right tabular-nums">{money(data.sales.withholding)}</td>
            </tr>
          )}
          <tr>
            <td className="py-0.5">− İndirilecek KDV (bu dönemin alışları)</td>
            <td className="py-0.5 text-right tabular-nums">{money(data.deductibleVat)}</td>
          </tr>
          <tr className="border-t border-slate-300 font-bold">
            <td className="py-1">{data.difference >= 0 ? "Fark (ödenecek yönünde)" : "Fark (devreden yönünde)"}</td>
            <td className="py-1 text-right tabular-nums">{money(Math.abs(data.difference))}</td>
          </tr>
          {data.kdv2 > 0 && (
            <tr>
              <td className="py-0.5 text-slate-600">KDV2 ile beyan edilecek tevkifat (alıcı sıfatıyla)</td>
              <td className="py-0.5 text-right tabular-nums">{money(data.kdv2)}</td>
            </tr>
          )}
        </tbody>
      </table>
      {data.missingRate > 0 && (
        <p className="text-xs text-amber-700">{data.missingRate} dövizli faturada kur bilgisi olmadığı için hesaba katılmadı.</p>
      )}
      <p className="text-xs text-slate-500">
        Sadece portala yüklenen e-Fatura / e-Arşiv faturalarına dayanır. Önceki dönemden devreden KDV, ithalat, serbest meslek
        makbuzu, gider pusulası, ÖKC fişleri ve indirim/istisna hesapları dahil değildir; beyanname yerine geçmez.
      </p>
    </div>
  );
}

export default function InvoicesView() {
  const [tab, setTab] = useState<Tab>("kdv");
  const [period, setPeriod] = useState(previousMonth);
  const [overview, setOverview] = useState<InvoiceOverviewRow[]>([]);
  const [detailFor, setDetailFor] = useState<string | null>(null);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [companyId, setCompanyId] = useState("");
  const [direction, setDirection] = useState<InvoiceDirection | "">("");
  const [search, setSearch] = useState("");
  const [query, setQuery] = useState("");
  const [rows, setRows] = useState<InvoiceRow[]>([]);
  const [total, setTotal] = useState(0);
  const [importing, setImporting] = useState(false);
  const [msg, setMsg] = useState<{ kind: "ok" | "err"; text: string } | null>(null);

  const listUrl = useCallback(
    (skip: number) => {
      const p = new URLSearchParams({ period, skip: String(skip) });
      if (companyId) p.set("companyId", companyId);
      if (direction) p.set("direction", direction);
      if (query) p.set("q", query);
      return `/invoices?${p}`;
    },
    [period, companyId, direction, query],
  );

  const load = useCallback(
    (isAlive: () => boolean = () => true) =>
      Promise.all([
        api<{ items: InvoiceOverviewRow[] }>(`/invoices/overview?period=${period}`),
        api<{ total: number; items: InvoiceRow[] }>(listUrl(0)),
      ]).then(([o, l]) => {
        if (!isAlive()) return;
        setOverview(o.items);
        setRows(l.items);
        setTotal(l.total);
      }),
    [period, listUrl],
  );

  useEffect(() => {
    let alive = true;
    load(() => alive).catch((e) => alive && setMsg({ kind: "err", text: e.message }));
    return () => {
      alive = false;
    };
  }, [load]);

  useEffect(() => {
    let alive = true;
    api<Company[]>("/companies")
      .then((c) => alive && setCompanies(c))
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, []);

  async function more() {
    const l = await api<{ total: number; items: InvoiceRow[] }>(listUrl(rows.length));
    setRows((r) => [...r, ...l.items]);
    setTotal(l.total);
  }

  async function remove(r: InvoiceRow) {
    if (!confirm(`${r.number} numaralı fatura portaldan silinsin mi? (Entegratördeki fatura etkilenmez.)`)) return;
    try {
      await api(`/invoices/${r.id}`, { method: "DELETE" });
      await load();
    } catch (e) {
      setMsg({ kind: "err", text: (e as Error).message });
    }
  }

  const sum = (k: keyof InvoiceOverviewRow) => overview.reduce((s, o) => s + (o[k] as number), 0);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold">Faturalar</h1>
          <p className="text-xs text-slate-500">e-Fatura ve e-Arşiv faturaları · Kaynak: entegratörden indirilen UBL-TR dosyaları</p>
        </div>
        <div className="flex items-center gap-2">
          <input
            type="month"
            value={period}
            onChange={(e) => e.target.value && setPeriod(e.target.value)}
            className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm"
            aria-label="Dönem"
          />
          <button
            onClick={() => setImporting(true)}
            className="flex items-center gap-2 rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700"
          >
            <Upload size={16} /> Fatura yükle
          </button>
        </div>
      </div>

      {msg && (
        <p className={`rounded-lg px-3 py-2 text-sm ${msg.kind === "ok" ? "bg-emerald-50 text-emerald-800" : "bg-red-50 text-red-700"}`}>{msg.text}</p>
      )}

      <div className="flex gap-2 border-b border-slate-200">
        {(
          [
            ["kdv", "KDV ön kontrol"],
            ["liste", `Fatura listesi (${total})`],
          ] as const
        ).map(([k, l]) => (
          <button
            key={k}
            onClick={() => setTab(k)}
            className={`-mb-px border-b-2 px-3 py-2 text-sm font-semibold ${
              tab === k ? "border-brand-600 text-brand-700" : "border-transparent text-slate-500 hover:text-slate-700"
            }`}
          >
            {l}
          </button>
        ))}
      </div>

      {tab === "kdv" && (
        <>
          {detailFor && <KdvDetail key={`${detailFor}-${period}`} companyId={detailFor} period={period} onClose={() => setDetailFor(null)} />}
          <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500">
                <tr>
                  <th className="px-4 py-3">Mükellef</th>
                  <th className="px-4 py-3 text-right">Satış</th>
                  <th className="px-4 py-3 text-right">Hesaplanan KDV</th>
                  <th className="px-4 py-3 text-right">Satış tevkifatı</th>
                  <th className="px-4 py-3 text-right">Alış</th>
                  <th className="px-4 py-3 text-right">İndirilecek KDV</th>
                  <th className="px-4 py-3 text-right">KDV2</th>
                  <th className="px-4 py-3 text-right">Fark</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {overview.map((o) => (
                  <tr
                    key={o.company.id}
                    onClick={() => setDetailFor(o.company.id)}
                    className={`cursor-pointer hover:bg-slate-50 ${detailFor === o.company.id ? "bg-brand-50" : ""}`}
                  >
                    <td className="min-w-48 px-4 py-2.5">
                      <p className="font-medium">{o.company.title}</p>
                      <p className="font-mono text-xs text-slate-500">
                        {o.company.taxNumber}
                        {o.missingRate > 0 && (
                          <span className="ml-2 inline-flex items-center gap-0.5 text-amber-700" title="Kur bilgisi olmayan dövizli fatura var">
                            <AlertTriangle size={11} /> {o.missingRate}
                          </span>
                        )}
                      </p>
                    </td>
                    <td className="px-4 py-2.5 text-right tabular-nums">
                      {tl(o.salesBase)}
                      <p className="text-xs text-slate-400">{o.salesCount} fatura</p>
                    </td>
                    <td className="px-4 py-2.5 text-right tabular-nums">{tl(o.calculatedVat)}</td>
                    <td className="px-4 py-2.5 text-right tabular-nums">{o.salesWithholding ? tl(o.salesWithholding) : "—"}</td>
                    <td className="px-4 py-2.5 text-right tabular-nums">
                      {tl(o.purchasesBase)}
                      <p className="text-xs text-slate-400">{o.purchasesCount} fatura</p>
                    </td>
                    <td className="px-4 py-2.5 text-right tabular-nums">{tl(o.deductibleVat)}</td>
                    <td className="px-4 py-2.5 text-right tabular-nums">{o.kdv2 ? tl(o.kdv2) : "—"}</td>
                    <td className={`px-4 py-2.5 text-right font-semibold tabular-nums ${o.difference >= 0 ? "text-slate-900" : "text-sky-700"}`}>
                      {tl(o.difference)}
                    </td>
                  </tr>
                ))}
                {overview.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="px-4 py-8 text-center text-slate-500">
                      Bu dönem için fatura yok. Entegratörden indirdiğiniz XML/ZIP dosyalarını &quot;Fatura yükle&quot; ile aktarın.
                    </td>
                  </tr>
                ) : (
                  <tr className="bg-slate-50 font-semibold">
                    <td className="px-4 py-2.5">Toplam ({overview.length} mükellef)</td>
                    <td className="px-4 py-2.5 text-right tabular-nums">{tl(sum("salesBase"))}</td>
                    <td className="px-4 py-2.5 text-right tabular-nums">{tl(sum("calculatedVat"))}</td>
                    <td className="px-4 py-2.5 text-right tabular-nums">{tl(sum("salesWithholding"))}</td>
                    <td className="px-4 py-2.5 text-right tabular-nums">{tl(sum("purchasesBase"))}</td>
                    <td className="px-4 py-2.5 text-right tabular-nums">{tl(sum("deductibleVat"))}</td>
                    <td className="px-4 py-2.5 text-right tabular-nums">{tl(sum("kdv2"))}</td>
                    <td className="px-4 py-2.5 text-right tabular-nums">{tl(sum("difference"))}</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          <p className="text-xs text-slate-500">
            Fark = hesaplanan KDV − satış tevkifatı (alıcının beyan ettiği) − indirilecek KDV. Devreden KDV ve fatura dışı belgeler dahil
            değildir; satıra tıklayınca oran kırılımı açılır.
          </p>
        </>
      )}

      {tab === "liste" && (
        <>
          <form
            className="flex flex-wrap items-center gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              setQuery(search.trim());
            }}
          >
            <select
              value={companyId}
              onChange={(e) => setCompanyId(e.target.value)}
              className="max-w-xs rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm"
              aria-label="Mükellef"
            >
              <option value="">Tüm mükellefler</option>
              {companies.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.title}
                </option>
              ))}
            </select>
            {(
              [
                ["", "Tümü"],
                ["OUTGOING", "Satış"],
                ["INCOMING", "Alış"],
              ] as const
            ).map(([v, l]) => (
              <button
                type="button"
                key={l}
                onClick={() => setDirection(v)}
                className={`rounded-full px-3 py-1 text-sm ${direction === v ? "bg-brand-600 text-white" : "bg-white text-slate-700 ring-1 ring-slate-200"}`}
              >
                {l}
              </button>
            ))}
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Fatura no, karşı taraf adı veya VKN"
              className="ml-auto w-64 rounded-lg border border-slate-300 px-3 py-1.5 text-sm"
            />
          </form>
          <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500">
                <tr>
                  <th className="px-4 py-3">Tarih</th>
                  <th className="px-4 py-3">Fatura</th>
                  <th className="px-4 py-3">Mükellef</th>
                  <th className="px-4 py-3">Karşı taraf</th>
                  <th className="px-4 py-3 text-right">Matrah</th>
                  <th className="px-4 py-3 text-right">KDV</th>
                  <th className="px-4 py-3 text-right">Ödenecek</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {rows.map((r) => (
                  <tr key={r.id} className="hover:bg-slate-50">
                    <td className="px-4 py-2.5 whitespace-nowrap">{formatDate(r.issueDate)}</td>
                    <td className="px-4 py-2.5">
                      <p className="flex items-center gap-1 font-mono text-xs">
                        {r.direction === "OUTGOING" ? (
                          <ArrowUpRight size={13} className="text-emerald-600" aria-label="Satış" />
                        ) : (
                          <ArrowDownLeft size={13} className="text-sky-600" aria-label="Alış" />
                        )}
                        {r.number}
                      </p>
                      <p className="text-xs text-slate-500">
                        {PROFILE_LABEL[r.profile] ?? r.profile} · {TYPE_LABEL[r.invoiceType] ?? r.invoiceType}
                        {r.source === "DEMO" && " · demo"}
                      </p>
                    </td>
                    <td className="px-4 py-2.5">{r.company.title}</td>
                    <td className="px-4 py-2.5">
                      <p>{r.counterpartyName ?? "—"}</p>
                      <p className="font-mono text-xs text-slate-500">{r.counterpartyTaxNumber ?? ""}</p>
                    </td>
                    <td className="px-4 py-2.5 text-right tabular-nums whitespace-nowrap">{money(r.taxExclusiveAmount, r.currency)}</td>
                    <td className="px-4 py-2.5 text-right tabular-nums whitespace-nowrap">
                      {money(r.vatAmount, r.currency)}
                      {r.withholdingAmount > 0 && <p className="text-xs text-amber-700">tevkifat {tl(r.withholdingAmount)}</p>}
                    </td>
                    <td className="px-4 py-2.5 text-right tabular-nums whitespace-nowrap">
                      {money(r.payableAmount, r.currency)}
                      {r.currency !== "TRY" && <p className="text-xs text-slate-500">{r.exchangeRate ? `kur ${r.exchangeRate}` : "kur yok"}</p>}
                    </td>
                    <td className="px-2 py-2.5">
                      <button onClick={() => remove(r)} className="rounded p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600" aria-label="Faturayı sil">
                        <Trash2 size={14} />
                      </button>
                    </td>
                  </tr>
                ))}
                {rows.length === 0 && (
                  <tr>
                    <td colSpan={8} className="px-4 py-8 text-center text-slate-500">
                      Fatura bulunamadı
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          {rows.length < total && (
            <button onClick={more} className="w-full rounded-lg border border-slate-200 bg-white py-2 text-sm text-slate-600 hover:bg-slate-50">
              Daha fazla göster ({total - rows.length} kaldı)
            </button>
          )}
        </>
      )}

      {importing && (
        <ImportModal
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
