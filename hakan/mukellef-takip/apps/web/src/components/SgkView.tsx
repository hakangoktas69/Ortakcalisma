"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { AlertTriangle, CheckCircle2, KeyRound, LogIn, LogOut, Plus, RefreshCw, UserCog, X } from "lucide-react";
import {
  api,
  formatDate,
  type Company,
  type EBildirgeDocument,
  type EmploymentEvent,
  type SgkReport,
  type SgkWorkplace,
  type SyncStatus,
} from "@/lib/api";

type Tab = "rapor" | "giris" | "bildirge" | "isyeri";

const money = (n: number | null) =>
  n === null ? "—" : n.toLocaleString("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const periodLabel = (p: string) => `${p.slice(5)}/${p.slice(0, 4)}`;
const KIND_LABEL: Record<string, string> = { ASIL: "Asıl", EK: "Ek", IPTAL: "İptal" };

function SyncCell({ status, at, error }: { status: SyncStatus; at: string | null; error: string | null }) {
  if (status === "OK") return <span className="text-emerald-700">✓ {new Date(at!).toLocaleString("tr-TR")}</span>;
  if (status === "RUNNING") return <span className="text-slate-500">Çalışıyor…</span>;
  if (status === "ERROR")
    return (
      <span className="block max-w-xs text-red-700" title={error ?? ""}>
        ✗ {error}
      </span>
    );
  return <span className="text-slate-400">Hiç</span>;
}

const maskTckn = (t: string) => `${t.slice(0, 3)}*****${t.slice(-3)}`;

function todaySgk() {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, "0");
  return `${p(d.getDate())}.${p(d.getMonth() + 1)}.${d.getFullYear()}`;
}

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

const input = "w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-brand-500";

export default function SgkView() {
  const [tab, setTab] = useState<Tab>("rapor");
  const [mode, setMode] = useState<"mock" | "live">("mock");
  const [tescilMode, setTescilMode] = useState<"mock" | "live">("mock");
  const [employment, setEmployment] = useState<EmploymentEvent[]>([]);
  const [empType, setEmpType] = useState<"ENTRY" | "EXIT" | "">("");
  const [empDays, setEmpDays] = useState(30);
  const [bildirges, setBildirges] = useState<EBildirgeDocument[]>([]);
  const [bildirgeMonths, setBildirgeMonths] = useState(6);
  const [workplaces, setWorkplaces] = useState<SgkWorkplace[]>([]);
  const [reports, setReports] = useState<SgkReport[]>([]);
  const [statusFilter, setStatusFilter] = useState<"PENDING" | "APPROVED" | "">("PENDING");
  const [msg, setMsg] = useState<{ kind: "ok" | "err"; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  const [approving, setApproving] = useState<SgkReport | null>(null);
  const [credFor, setCredFor] = useState<SgkWorkplace | null>(null);
  const [tescilFor, setTescilFor] = useState<SgkWorkplace | null>(null);
  const [adding, setAdding] = useState(false);

  const fetchData = useCallback(
    () =>
      Promise.all([
        api<{ mode: "mock" | "live"; tescilMode: "mock" | "live"; items: SgkWorkplace[] }>("/sgk/workplaces"),
        api<SgkReport[]>(`/sgk/reports${statusFilter ? `?status=${statusFilter}` : ""}`),
        api<EmploymentEvent[]>(`/sgk/employment?days=${empDays}${empType ? `&type=${empType}` : ""}`),
        api<EBildirgeDocument[]>(`/sgk/ebildirge?months=${bildirgeMonths}`),
      ]),
    [statusFilter, empDays, empType, bildirgeMonths],
  );

  const load = useCallback(
    (isAlive: () => boolean = () => true) =>
      fetchData().then(([w, r, e, b]) => {
        if (!isAlive()) return;
        setMode(w.mode);
        setTescilMode(w.tescilMode);
        setWorkplaces(w.items);
        setReports(r);
        setEmployment(e);
        setBildirges(b);
      }),
    [fetchData],
  );

  useEffect(() => {
    let alive = true;
    load(() => alive).catch((e) => alive && setMsg({ kind: "err", text: e.message }));
    return () => {
      alive = false;
    };
  }, [load]);

  async function syncAll() {
    setBusy(true);
    setMsg(null);
    try {
      const { queued } = await api<{ queued: number }>("/sgk/sync", { method: "POST" });
      setMsg({ kind: "ok", text: `${queued} işyeri senkron kuyruğuna alındı. Sonuçlar birkaç saniye içinde gelir.` });
      setTimeout(() => load().finally(() => setBusy(false)), 4000);
    } catch (e) {
      setMsg({ kind: "err", text: (e as Error).message });
      setBusy(false);
    }
  }

  async function syncOne(w: SgkWorkplace) {
    setBusy(true);
    try {
      const { result } = await api<{
        result: { vizite?: { pending: number }; tescil?: { entries: number; exits: number }; error?: string };
      }>(
        `/sgk/sync?workplaceId=${w.id}`,
        { method: "POST" },
      );
      setMsg(
        result.error
          ? { kind: "err", text: `${w.company.title}: ${result.error}` }
          : {
              kind: "ok",
              text: [
                `${w.company.title}:`,
                result.vizite && `${result.vizite.pending} yeni rapor`,
                result.tescil && `${result.tescil.entries} giriş, ${result.tescil.exits} çıkış kaydı`,
              ]
                .filter(Boolean)
                .join(" "),
            },
      );
      await load();
    } finally {
      setBusy(false);
    }
  }

  const errors = workplaces.filter((w) => w.lastSyncStatus === "ERROR" || w.tescilLastSyncStatus === "ERROR").length;
  const lastSync = useMemo(
    () =>
      workplaces
        .map((w) => w.lastSyncAt)
        .filter(Boolean)
        .sort()
        .at(-1) ?? null,
    [workplaces],
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold">SGK İşlemleri</h1>
          <p className="text-xs text-slate-500">
            Kaynak: SGK Vizite ve 4A Sigortalı Tescil web servisleri · Son senkron: {lastSync ? new Date(lastSync).toLocaleString("tr-TR") : "—"}
          </p>
        </div>
        <button
          onClick={syncAll}
          disabled={busy}
          className="flex items-center gap-2 rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-60"
        >
          <RefreshCw size={16} className={busy ? "animate-spin" : ""} /> Tümünü yenile
        </button>
      </div>

      {mode === "mock" && (
        <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
          <b>Demo modu:</b> SGK&apos;ya bağlanılmıyor, raporlar sahte verilerle üretiliyor. Gerçek servise geçmek için API
          ayarlarında <code>SGK_MODE=&quot;live&quot;</code> yapın.
        </p>
      )}
      {errors > 0 && (
        <p className="flex items-center gap-2 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
          <AlertTriangle size={16} /> {errors} işyerinde senkron hatası var. İşyerleri sekmesinden kontrol edin.
        </p>
      )}
      {msg && (
        <p className={`rounded-lg px-3 py-2 text-sm ${msg.kind === "ok" ? "bg-emerald-50 text-emerald-800" : "bg-red-50 text-red-700"}`}>
          {msg.text}
        </p>
      )}

      <div className="flex gap-2 border-b border-slate-200">
        {(
          [
            ["rapor", "e-Rapor (Vizite)"],
            ["giris", "İşe Giriş / Çıkış"],
            ["bildirge", "e-Bildirge"],
            ["isyeri", `İşyerleri (${workplaces.length})`],
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

      {tab === "rapor" && (
        <>
          <div className="flex gap-2">
            {(
              [
                ["PENDING", "Bekleyen"],
                ["APPROVED", "Onaylı"],
                ["", "Tümü"],
              ] as const
            ).map(([v, l]) => (
              <button
                key={l}
                onClick={() => setStatusFilter(v)}
                className={`rounded-full px-3 py-1 text-sm ${statusFilter === v ? "bg-brand-600 text-white" : "bg-white text-slate-700 ring-1 ring-slate-200"}`}
              >
                {l}
              </button>
            ))}
          </div>
          <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500">
                <tr>
                  <th className="px-4 py-3">Firma</th>
                  <th className="px-4 py-3">Sigortalı</th>
                  <th className="px-4 py-3">Vaka</th>
                  <th className="px-4 py-3">Rapor</th>
                  <th className="px-4 py-3">İş başı kontrol</th>
                  <th className="px-4 py-3">Durum</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {reports.map((r) => (
                  <tr key={r.id} className="hover:bg-slate-50">
                    <td className="px-4 py-2.5">
                      <p className="font-medium">{r.workplace.company.title}</p>
                      <p className="text-xs text-slate-500">{r.facilityName ?? ""}</p>
                    </td>
                    <td className="px-4 py-2.5">
                      <p>{r.fullName}</p>
                      <p className="font-mono text-xs text-slate-500">{maskTckn(r.tckn)}</p>
                    </td>
                    <td className="px-4 py-2.5">{r.vakaAdi ?? r.vaka}</td>
                    <td className="px-4 py-2.5 whitespace-nowrap">
                      {formatDate(r.startDate)} – {formatDate(r.endDate)}
                    </td>
                    <td className="px-4 py-2.5">{formatDate(r.workControlDate)}</td>
                    <td className="px-4 py-2.5">
                      {r.status === "APPROVED" ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-semibold text-emerald-800">
                          <CheckCircle2 size={12} /> Onaylı
                        </span>
                      ) : (
                        <button
                          onClick={() => setApproving(r)}
                          className="rounded-lg bg-brand-600 px-3 py-1 text-xs font-semibold text-white hover:bg-brand-700"
                        >
                          Onayla
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
                {reports.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-4 py-8 text-center text-slate-500">
                      Rapor yok
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </>
      )}

      {tab === "giris" && (
        <>
          {tescilMode === "live" && (
            <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
              Canlı 4A bağlantısı henüz kurulmadı: SGK kullanım kılavuzu ve test ortamı erişimi bekleniyor.
            </p>
          )}
          <div className="flex flex-wrap items-center gap-2">
            {(
              [
                ["", "Tümü"],
                ["ENTRY", "Girişler"],
                ["EXIT", "Çıkışlar"],
              ] as const
            ).map(([v, l]) => (
              <button
                key={l}
                onClick={() => setEmpType(v)}
                className={`rounded-full px-3 py-1 text-sm ${empType === v ? "bg-brand-600 text-white" : "bg-white text-slate-700 ring-1 ring-slate-200"}`}
              >
                {l}
              </button>
            ))}
            <select
              value={empDays}
              onChange={(e) => setEmpDays(Number(e.target.value))}
              className="ml-auto rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm"
            >
              <option value={7}>Son 7 gün</option>
              <option value={30}>Son 30 gün</option>
              <option value={90}>Son 90 gün</option>
              <option value={365}>Son 1 yıl</option>
            </select>
          </div>
          <p className="text-xs text-slate-500">
            {employment.filter((e) => e.type === "ENTRY").length} giriş ·{" "}
            {employment.filter((e) => e.type === "EXIT").length} çıkış. Bu ekran SGK&apos;ya verilmiş bildirgeleri
            okur; bildirge göndermez.
          </p>
          <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500">
                <tr>
                  <th className="px-4 py-3">Tarih</th>
                  <th className="px-4 py-3">Hareket</th>
                  <th className="px-4 py-3">Firma</th>
                  <th className="px-4 py-3">Sigortalı</th>
                  <th className="px-4 py-3">Meslek kodu</th>
                  <th className="px-4 py-3">Ayrılış nedeni</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {employment.map((e) => (
                  <tr key={e.id} className="hover:bg-slate-50">
                    <td className="px-4 py-2.5 whitespace-nowrap">{formatDate(e.eventDate)}</td>
                    <td className="px-4 py-2.5">
                      {e.type === "ENTRY" ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-semibold text-emerald-800">
                          <LogIn size={12} /> Giriş
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 rounded-full bg-rose-100 px-2.5 py-0.5 text-xs font-semibold text-rose-800">
                          <LogOut size={12} /> Çıkış
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-2.5">{e.workplace.company.title}</td>
                    <td className="px-4 py-2.5">
                      <p>{e.fullName}</p>
                      <p className="font-mono text-xs text-slate-500">{maskTckn(e.tckn)}</p>
                    </td>
                    <td className="px-4 py-2.5 font-mono text-xs">{e.occupationCode ?? "—"}</td>
                    <td className="px-4 py-2.5 text-xs" title={e.exitReason ?? ""}>
                      {e.exitReasonCode ? `${e.exitReasonCode} · ${e.exitReason ?? ""}` : "—"}
                    </td>
                  </tr>
                ))}
                {employment.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-4 py-8 text-center text-slate-500">
                      Bu aralıkta kayıt yok
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </>
      )}

      {tab === "bildirge" && (
        <>
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-xs text-slate-500">
              SGK e-Bildirge&apos;de onaylanmış aylık prim ve hizmet belgeleri. Veriler, SGK sayfasını açıp tarayıcı eklentisiyle
              aktardığınızda gelir; portal SGK&apos;ya kendisi bağlanmaz.
            </p>
            <select
              value={bildirgeMonths}
              onChange={(e) => setBildirgeMonths(Number(e.target.value))}
              className="ml-auto rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm"
            >
              <option value={3}>Son 3 ay</option>
              <option value={6}>Son 6 ay</option>
              <option value={12}>Son 12 ay</option>
              <option value={24}>Son 24 ay</option>
            </select>
          </div>
          <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500">
                <tr>
                  <th className="px-4 py-3">Dönem</th>
                  <th className="px-4 py-3">Firma / İşyeri</th>
                  <th className="px-4 py-3">Belge</th>
                  <th className="px-4 py-3">Kanun</th>
                  <th className="px-4 py-3">Mahiyet</th>
                  <th className="px-4 py-3 text-right">Sigortalı</th>
                  <th className="px-4 py-3 text-right">Gün</th>
                  <th className="px-4 py-3 text-right">PEK (TL)</th>
                  <th className="px-4 py-3 text-right">Tahakkuk (TL)</th>
                  <th className="px-4 py-3">Onay</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {bildirges.map((b) => (
                  <tr key={b.id} className="hover:bg-slate-50">
                    <td className="px-4 py-2.5 font-mono whitespace-nowrap">{periodLabel(b.period)}</td>
                    <td className="min-w-48 px-4 py-2.5">
                      <p className="font-medium">{b.workplace.company.title}</p>
                      <p className="font-mono text-xs text-slate-500">{b.workplace.name ?? b.workplace.registryNo}</p>
                    </td>
                    <td className="px-4 py-2.5 font-mono">{b.documentType}</td>
                    <td className="px-4 py-2.5 font-mono">{b.lawNo}</td>
                    <td className="px-4 py-2.5">
                      <span
                        className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                          b.kind === "IPTAL" ? "bg-rose-100 text-rose-800" : b.kind === "EK" ? "bg-amber-100 text-amber-800" : "bg-slate-100 text-slate-700"
                        }`}
                      >
                        {KIND_LABEL[b.kind] ?? b.kind}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 text-right tabular-nums">{b.insuredCount ?? "—"}</td>
                    <td className="px-4 py-2.5 text-right tabular-nums">{b.totalDays ?? "—"}</td>
                    <td className="px-4 py-2.5 text-right tabular-nums">{money(b.premiumBase)}</td>
                    <td className="px-4 py-2.5 text-right tabular-nums">{money(b.accrualAmount)}</td>
                    <td className="px-4 py-2.5 whitespace-nowrap">
                      {b.approvedAt ? formatDate(b.approvedAt) : "—"}
                      {b.source === "DEMO" && <span className="ml-1 text-xs text-slate-400">(demo)</span>}
                    </td>
                  </tr>
                ))}
                {bildirges.length === 0 && (
                  <tr>
                    <td colSpan={10} className="px-4 py-8 text-center text-slate-500">
                      Bu aralıkta belge yok. SGK e-Bildirge&apos;de onaylı bildirge listesini açıp eklentiyle aktarın.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </>
      )}

      {tab === "isyeri" && (
        <>
          <button
            onClick={() => setAdding(true)}
            className="flex items-center gap-2 rounded-lg bg-white px-3 py-2 text-sm font-semibold text-brand-700 ring-1 ring-brand-200 hover:bg-brand-50"
          >
            <Plus size={16} /> İşyeri / şube ekle
          </button>
          <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500">
                <tr>
                  <th className="px-4 py-3">Firma / işyeri</th>
                  <th className="px-4 py-3">Sicil no</th>
                  <th className="px-4 py-3">Giriş bilgileri</th>
                  <th className="px-4 py-3">Son senkron</th>
                  <th className="px-4 py-3">Bekleyen</th>
                  <th className="px-4 py-3"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {workplaces.map((w) => (
                  <tr key={w.id} className="align-top hover:bg-slate-50">
                    <td className="px-4 py-2.5">
                      <p className="font-medium">{w.company.title}</p>
                      <p className="text-xs text-slate-500">
                        {w.name ?? "—"} {w.isBranch && <span className="rounded bg-slate-100 px-1">şube</span>}
                      </p>
                    </td>
                    <td className="px-4 py-2.5 font-mono text-xs">{w.registryNo}</td>
                    <td className="px-4 py-2.5">
                      <p className={`text-xs ${w.hasCredentials ? "text-slate-600" : "text-amber-700"}`}>
                        Vizite: {w.hasCredentials ? `işyeri kodu ${w.viziteWorkplaceCode} · şifre kayıtlı` : "girilmemiş"}
                      </p>
                      <p className={`text-xs ${w.hasTescilCredentials ? "text-slate-600" : "text-amber-700"}`}>
                        4A: {w.hasTescilCredentials ? `${w.tescilUsername} · şifreler kayıtlı` : "girilmemiş"}
                      </p>
                    </td>
                    <td className="space-y-0.5 px-4 py-2.5 text-xs">
                      <p>
                        <span className="text-slate-500">Vizite </span>
                        <SyncCell status={w.lastSyncStatus} at={w.lastSyncAt} error={w.lastSyncError} />
                      </p>
                      <p>
                        <span className="text-slate-500">4A </span>
                        <SyncCell status={w.tescilLastSyncStatus} at={w.tescilLastSyncAt} error={w.tescilLastSyncError} />
                      </p>
                    </td>
                    <td className="px-4 py-2.5">{w.pendingReports}</td>
                    <td className="px-4 py-2.5">
                      <div className="flex justify-end gap-1">
                        <button
                          onClick={() => setCredFor(w)}
                          className="rounded-lg p-1.5 text-slate-600 hover:bg-slate-100"
                          title="Vizite giriş bilgileri"
                        >
                          <KeyRound size={16} />
                        </button>
                        <button
                          onClick={() => setTescilFor(w)}
                          className="rounded-lg p-1.5 text-slate-600 hover:bg-slate-100"
                          title="4A işe giriş/çıkış giriş bilgileri"
                        >
                          <UserCog size={16} />
                        </button>
                        <button
                          onClick={() => syncOne(w)}
                          disabled={busy || (!w.hasCredentials && !w.hasTescilCredentials)}
                          className="rounded-lg p-1.5 text-slate-600 hover:bg-slate-100 disabled:opacity-40"
                          title="Şimdi senkronla"
                        >
                          <RefreshCw size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {approving && (
        <ApproveModal
          report={approving}
          live={mode === "live"}
          onClose={() => setApproving(null)}
          onDone={(text) => {
            setApproving(null);
            setMsg({ kind: "ok", text });
            load();
          }}
        />
      )}
      {credFor && (
        <CredentialsModal
          workplace={credFor}
          onClose={() => setCredFor(null)}
          onDone={() => {
            setCredFor(null);
            setMsg({ kind: "ok", text: "Vizite bilgileri doğrulandı ve şifreli olarak kaydedildi." });
            load();
          }}
          onRemoved={() => {
            setCredFor(null);
            setMsg({ kind: "ok", text: "Vizite bilgileri silindi." });
            load();
          }}
        />
      )}
      {tescilFor && (
        <TescilCredentialsModal
          workplace={tescilFor}
          onClose={() => setTescilFor(null)}
          onDone={() => {
            setTescilFor(null);
            setMsg({ kind: "ok", text: "4A bilgileri doğrulandı ve şifreli olarak kaydedildi." });
            load();
          }}
          onRemoved={() => {
            setTescilFor(null);
            setMsg({ kind: "ok", text: "4A bilgileri silindi." });
            load();
          }}
        />
      )}
      {adding && (
        <AddWorkplaceModal
          onClose={() => setAdding(false)}
          onDone={() => {
            setAdding(false);
            load();
          }}
        />
      )}
    </div>
  );
}

function ApproveModal({
  report,
  live,
  onClose,
  onDone,
}: {
  report: SgkReport;
  live: boolean;
  onClose: () => void;
  onDone: (msg: string) => void;
}) {
  const [nitelik, setNitelik] = useState<"0" | "1">("0");
  const [tarih, setTarih] = useState(todaySgk());
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      await api(`/sgk/reports/${report.id}/approve`, {
        method: "POST",
        body: JSON.stringify({ nitelikDurumu: nitelik, tarih }),
      });
      onDone(`${report.fullName} için çalışmazlık bildirimi yapıldı.`);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal title="Çalışmazlık bildirimi" onClose={onClose}>
      <form onSubmit={submit} className="space-y-3 text-sm">
        <p>
          <b>{report.fullName}</b> · {report.workplace.company.title}
          <br />
          <span className="text-slate-500">
            {report.vakaAdi} · {formatDate(report.startDate)} – {formatDate(report.endDate)}
          </span>
        </p>
        <label className="block">
          <span className="font-medium">İstirahat döneminde</span>
          <select value={nitelik} onChange={(e) => setNitelik(e.target.value as "0" | "1")} className={`mt-1 ${input}`}>
            <option value="0">Çalışmadı</option>
            <option value="1">Çalıştı</option>
          </select>
        </label>
        <label className="block">
          <span className="font-medium">Tarih (gg.aa.yyyy)</span>
          <input value={tarih} onChange={(e) => setTarih(e.target.value)} className={`mt-1 ${input}`} />
        </label>
        {live && (
          <p className="rounded-lg bg-amber-50 px-3 py-2 text-amber-800">
            Bu işlem SGK&apos;ya gerçek bildirim gönderir ve sonradan ancak SGK üzerinden iptal edilebilir.
          </p>
        )}
        {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-red-700">{error}</p>}
        <button disabled={saving} className="w-full rounded-lg bg-brand-600 py-2 font-semibold text-white hover:bg-brand-700 disabled:opacity-60">
          {saving ? "Gönderiliyor…" : "Bildirimi gönder"}
        </button>
      </form>
    </Modal>
  );
}

/** Kayıtlı kurum bilgilerini siler; yanlışlıkla silmeye karşı pencere içinde ikinci onay ister */
function RemoveCredentials({ path, label, onDone }: { path: string; label: string; onDone: () => void }) {
  const [asking, setAsking] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function remove() {
    setBusy(true);
    setError(null);
    try {
      await api(path, { method: "DELETE" });
      onDone();
    } catch (err) {
      setError((err as Error).message);
      setBusy(false);
    }
  }

  return (
    <div className="border-t border-slate-200 pt-3">
      {asking ? (
        <div className="flex flex-wrap items-center gap-2">
          <span className="flex-1 text-red-700">{label} silinsin mi? Senkron bu işyeri için durur.</span>
          <button type="button" onClick={() => setAsking(false)} className="rounded-lg px-3 py-1.5 text-slate-600 hover:bg-slate-100">
            Vazgeç
          </button>
          <button type="button" onClick={remove} disabled={busy} className="rounded-lg bg-red-600 px-3 py-1.5 font-semibold text-white hover:bg-red-700 disabled:opacity-60">
            {busy ? "Siliniyor…" : "Sil"}
          </button>
        </div>
      ) : (
        <button type="button" onClick={() => setAsking(true)} className="text-red-700 hover:underline">
          Kayıtlı {label}ni sil
        </button>
      )}
      {error && <p className="mt-2 rounded-lg bg-red-50 px-3 py-2 text-red-700">{error}</p>}
    </div>
  );
}

function CredentialsModal({
  workplace,
  onClose,
  onDone,
  onRemoved,
}: {
  workplace: SgkWorkplace;
  onClose: () => void;
  onDone: () => void;
  onRemoved: () => void;
}) {
  const [username, setUsername] = useState(workplace.viziteUsername ?? "");
  const [code, setCode] = useState(workplace.viziteWorkplaceCode ?? "");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      await api(`/sgk/workplaces/${workplace.id}/vizite-credentials`, {
        method: "PUT",
        body: JSON.stringify({ username, workplaceCode: code, password }),
      });
      onDone();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal title="Vizite giriş bilgileri" onClose={onClose}>
      <form onSubmit={submit} className="space-y-3 text-sm">
        <p className="text-slate-600">
          {workplace.company.title} · {workplace.name}
        </p>
        <input required placeholder="Kullanıcı kodu (T.C. kimlik no)" inputMode="numeric" value={username}
          onChange={(e) => setUsername(e.target.value.replace(/\D/g, "").slice(0, 11))} className={input} />
        <input required placeholder="İşyeri kodu" inputMode="numeric" value={code}
          onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 4))} className={input} />
        <input required type="password" autoComplete="new-password" placeholder={workplace.hasCredentials ? "Yeni şifre (kayıtlı şifre gösterilmez)" : "Vizite web servis şifresi"}
          value={password} onChange={(e) => setPassword(e.target.value)} className={input} />
        <p className="text-xs text-slate-500">
          Bilgiler önce SGK&apos;da denenir, giriş başarılıysa AES-256 ile şifrelenerek saklanır. Şifre bir daha
          ekranda gösterilmez.
        </p>
        {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-red-700">{error}</p>}
        <button disabled={saving} className="w-full rounded-lg bg-brand-600 py-2 font-semibold text-white hover:bg-brand-700 disabled:opacity-60">
          {saving ? "SGK'da deneniyor…" : "Doğrula ve kaydet"}
        </button>
        {workplace.hasCredentials && (
          <RemoveCredentials path={`/sgk/workplaces/${workplace.id}/vizite-credentials`} label="Vizite bilgileri" onDone={onRemoved} />
        )}
      </form>
    </Modal>
  );
}

function TescilCredentialsModal({
  workplace,
  onClose,
  onDone,
  onRemoved,
}: {
  workplace: SgkWorkplace;
  onClose: () => void;
  onDone: () => void;
  onRemoved: () => void;
}) {
  const [username, setUsername] = useState(workplace.tescilUsername ?? "");
  const [systemPassword, setSystemPassword] = useState("");
  const [workplacePassword, setWorkplacePassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      await api(`/sgk/workplaces/${workplace.id}/tescil-credentials`, {
        method: "PUT",
        body: JSON.stringify({ username, systemPassword, workplacePassword }),
      });
      onDone();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal title="4A işe giriş/çıkış giriş bilgileri" onClose={onClose}>
      <form onSubmit={submit} className="space-y-3 text-sm">
        <p className="text-slate-600">
          {workplace.company.title} · {workplace.name}
        </p>
        <input required placeholder="Kullanıcı adı" value={username} onChange={(e) => setUsername(e.target.value)} className={input} />
        <input required type="password" autoComplete="new-password" placeholder="Sistem şifresi" value={systemPassword}
          onChange={(e) => setSystemPassword(e.target.value)} className={input} />
        <input required type="password" autoComplete="new-password" placeholder="İşyeri şifresi" value={workplacePassword}
          onChange={(e) => setWorkplacePassword(e.target.value)} className={input} />
        <p className="text-xs text-slate-500">
          Bunlar Vizite şifresinden ayrı, e-Bildirge giriş bilgileridir. Önce SGK&apos;da denenir, sonra iki şifre ayrı
          ayrı AES-256 ile şifrelenerek saklanır ve bir daha gösterilmez.
        </p>
        {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-red-700">{error}</p>}
        <button disabled={saving} className="w-full rounded-lg bg-brand-600 py-2 font-semibold text-white hover:bg-brand-700 disabled:opacity-60">
          {saving ? "SGK'da deneniyor…" : "Doğrula ve kaydet"}
        </button>
        {workplace.hasTescilCredentials && (
          <RemoveCredentials path={`/sgk/workplaces/${workplace.id}/tescil-credentials`} label="4A bilgileri" onDone={onRemoved} />
        )}
      </form>
    </Modal>
  );
}

function AddWorkplaceModal({ onClose, onDone }: { onClose: () => void; onDone: () => void }) {
  const [companies, setCompanies] = useState<Company[]>([]);
  const [companyId, setCompanyId] = useState("");
  const [registryNo, setRegistryNo] = useState("");
  const [name, setName] = useState("Merkez");
  const [isBranch, setIsBranch] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api<Company[]>("/companies").then((c) => {
      setCompanies(c.filter((x) => x.isActive));
      if (c[0]) setCompanyId(c[0].id);
    });
  }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      await api("/sgk/workplaces", { method: "POST", body: JSON.stringify({ companyId, registryNo, name, isBranch }) });
      onDone();
    } catch (err) {
      setError((err as Error).message);
    }
  }

  return (
    <Modal title="İşyeri / şube ekle" onClose={onClose}>
      <form onSubmit={submit} className="space-y-3 text-sm">
        <select value={companyId} onChange={(e) => setCompanyId(e.target.value)} className={input}>
          {companies.map((c) => (
            <option key={c.id} value={c.id}>{c.title}</option>
          ))}
        </select>
        <input required placeholder="İşyeri sicil numarası" value={registryNo} onChange={(e) => setRegistryNo(e.target.value)} className={input} />
        <input placeholder="Ad (Merkez, Şube 1…)" value={name} onChange={(e) => setName(e.target.value)} className={input} />
        <label className="flex items-center gap-2">
          <input type="checkbox" checked={isBranch} onChange={(e) => setIsBranch(e.target.checked)} /> Şube
        </label>
        {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-red-700">{error}</p>}
        <button className="w-full rounded-lg bg-brand-600 py-2 font-semibold text-white hover:bg-brand-700">Ekle</button>
      </form>
    </Modal>
  );
}
