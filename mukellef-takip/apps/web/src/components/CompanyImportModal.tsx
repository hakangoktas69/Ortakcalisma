"use client";

import { useState } from "react";
import { Download, Upload, X } from "lucide-react";
import { ApiError, downloadFile, getToken } from "@/lib/api";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000/api";

interface PreviewRow {
  row: number;
  title: string;
  taxNumber: string;
  action: "create" | "update" | "error";
  existingTitle: string | null;
  errors: string[];
  warnings: string[];
}

interface ImportResult {
  dryRun: boolean;
  total: number;
  create: number;
  update: number;
  error: number;
  quota: number;
  used: number;
  rows: PreviewRow[];
}

/** Dosyayı çok parçalı form olarak gönderir (api() JSON gönderdiği için ayrı). */
async function upload(file: File, dryRun: boolean): Promise<ImportResult> {
  const fd = new FormData();
  fd.append("file", file);
  const token = getToken();
  const res = await fetch(`${API_URL}/companies/import?dryRun=${dryRun}`, {
    method: "POST",
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    body: fd,
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError(res.status, Array.isArray(body.message) ? body.message.join(", ") : body.message ?? "Yükleme başarısız");
  return body;
}

const actionLabel = { create: "Eklenecek", update: "Güncellenecek", error: "Hatalı" } as const;
const actionClass = { create: "text-emerald-700", update: "text-sky-700", error: "text-red-700" } as const;

export default function CompanyImportModal({ onClose, onDone }: { onClose: () => void; onDone: (msg: string) => void }) {
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<ImportResult | null>(null);
  const [onlyProblems, setOnlyProblems] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function check(f: File) {
    setFile(f);
    setPreview(null);
    setError(null);
    setBusy(true);
    try {
      setPreview(await upload(f, true));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function commit() {
    if (!file) return;
    setBusy(true);
    setError(null);
    try {
      const r = await upload(file, false);
      onDone(`${r.create} firma eklendi, ${r.update} firma güncellendi${r.error ? `; ${r.error} satır hatalı olduğu için atlandı` : ""}.`);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  const rows = preview?.rows.filter((r) => !onlyProblems || r.action === "error" || r.warnings.length) ?? [];

  return (
    <div className="fixed inset-0 z-30 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div className="flex max-h-[90vh] w-full max-w-3xl flex-col rounded-2xl bg-white shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
          <h2 className="font-bold">Excel&apos;den firma aktar</h2>
          <button onClick={onClose} className="rounded p-1 text-slate-500 hover:bg-slate-100" aria-label="Kapat"><X size={18} /></button>
        </div>

        <div className="space-y-3 overflow-y-auto px-5 py-4 text-sm">
          <ol className="list-decimal space-y-1 pl-5 text-slate-700">
            <li>
              Şablonu indirin ve doldurun (ya da kendi listenizi kullanın; &quot;Unvan&quot; ve &quot;VKN / TCKN&quot; sütunları yeterli).{" "}
              <button onClick={() => downloadFile("/companies/import/template").catch((e) => setError(e.message))} className="inline-flex items-center gap-1 font-semibold text-brand-700 hover:underline">
                <Download size={14} /> Şablonu indir
              </button>
            </li>
            <li>Dosyayı seçin (.xlsx veya .csv, en fazla 2 MB). Önce önizleme gösterilir, hiçbir şey yazılmaz.</li>
            <li>Önizlemeyi kontrol edip &quot;Aktar&quot;a basın. Portalda kayıtlı VKN&apos;ler güncellenir, boş hücreler mevcut bilgiyi silmez.</li>
          </ol>

          <label className="flex cursor-pointer items-center justify-center gap-2 rounded-xl border-2 border-dashed border-slate-300 px-4 py-6 text-slate-600 hover:border-brand-400 hover:bg-brand-50">
            <Upload size={18} />
            {file ? file.name : "Dosya seçin"}
            <input type="file" accept=".xlsx,.csv" className="sr-only" onChange={(e) => e.target.files?.[0] && check(e.target.files[0])} />
          </label>

          {busy && <p className="text-slate-500">İşleniyor…</p>}
          {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-red-700">{error}</p>}

          {preview && (
            <>
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 rounded-lg bg-slate-50 px-3 py-2">
                <span><b className="text-emerald-700">{preview.create}</b> eklenecek</span>
                <span><b className="text-sky-700">{preview.update}</b> güncellenecek</span>
                <span><b className="text-red-700">{preview.error}</b> hatalı</span>
                <span className="text-xs text-slate-500">Kota: {preview.used} + {preview.create} / {preview.quota}</span>
                <label className="ml-auto flex items-center gap-1 text-xs">
                  <input type="checkbox" checked={onlyProblems} onChange={(e) => setOnlyProblems(e.target.checked)} /> Sadece hata ve uyarılar
                </label>
              </div>
              <div className="max-h-80 overflow-y-auto rounded-lg border border-slate-200">
                <table className="w-full text-xs">
                  <thead className="sticky top-0 bg-slate-50 text-left uppercase text-slate-500">
                    <tr>
                      <th className="px-3 py-2">Satır</th>
                      <th className="px-3 py-2">Unvan</th>
                      <th className="px-3 py-2">VKN/TCKN</th>
                      <th className="px-3 py-2">Sonuç</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {rows.map((r) => (
                      <tr key={r.row} className={r.action === "error" ? "bg-red-50/50" : ""}>
                        <td className="px-3 py-1.5 tabular-nums">{r.row}</td>
                        <td className="px-3 py-1.5">
                          {r.title || "—"}
                          {r.existingTitle && r.existingTitle !== r.title && <span className="block text-slate-500">Portalda: {r.existingTitle}</span>}
                        </td>
                        <td className="px-3 py-1.5 font-mono">{r.taxNumber || "—"}</td>
                        <td className="px-3 py-1.5">
                          <span className={`font-semibold ${actionClass[r.action]}`}>{actionLabel[r.action]}</span>
                          {r.errors.map((e) => <span key={e} className="block text-red-700">{e}</span>)}
                          {r.warnings.map((w) => <span key={w} className="block text-amber-700">Uyarı: {w}</span>)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>

        <div className="flex justify-end gap-2 border-t border-slate-100 px-5 py-3">
          <button onClick={onClose} className="rounded-lg px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-100">Vazgeç</button>
          <button
            onClick={commit}
            disabled={busy || !preview || preview.create + preview.update === 0}
            className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-50"
          >
            Aktar{preview ? ` (${preview.create + preview.update})` : ""}
          </button>
        </div>
      </div>
    </div>
  );
}
