"use client";

import { useState } from "react";
import { Download, FileSpreadsheet } from "lucide-react";
import { downloadFile } from "@/lib/api";

type Param = "month" | "days" | null;

const REPORTS: { kind: string; title: string; description: string; param: Param; personal?: string }[] = [
  { kind: "firmalar", title: "Firma listesi", description: "Unvan, VKN, vergi dairesi, tür, durum, e-Defter ve SGK işyeri sayısı", param: null },
  { kind: "beyanname", title: "Beyanname kontrol", description: "Seçilen dönemde firma × beyanname durumu, verilme tarihi ve tahakkuk", param: "month" },
  { kind: "edefter", title: "e-Defter berat durumu", description: "Seçilen ay için berat son günü, durum ve yükleme tarihi", param: "month" },
  { kind: "tebligat", title: "e-Tebligat listesi", description: "Ulaşma ve tebliğ sayılma tarihleri, okunma ve inceleme durumu", param: "days" },
  { kind: "sgk-rapor", title: "SGK e-Rapor (Vizite)", description: "Sigortalı raporları ve onay durumu", param: null, personal: "T.C. kimlik no ve sağlık verisi (özel nitelikli kişisel veri) içerir; KVKK kapsamında dikkatli paylaşın." },
  { kind: "ise-giris-cikis", title: "İşe giriş / işten çıkış", description: "SGK 4A bildirgeleri, ayrılış nedenleri", param: "days", personal: "T.C. kimlik no içerir; KVKK kapsamında dikkatli paylaşın." },
];

function prevMonth() {
  const d = new Date();
  d.setDate(1);
  d.setMonth(d.getMonth() - 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

export default function ReportsView() {
  const [month, setMonth] = useState(prevMonth);
  const [days, setDays] = useState(90);
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<{ kind: "ok" | "err"; text: string } | null>(null);

  async function download(kind: string, param: Param) {
    setBusy(kind);
    setMsg(null);
    try {
      const q = param === "month" ? `?month=${month}` : param === "days" ? `?days=${days}` : "";
      const name = await downloadFile(`/reports/${kind}${q}`);
      setMsg({ kind: "ok", text: `${name} indirildi.` });
    } catch (e) {
      setMsg({ kind: "err", text: (e as Error).message });
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-bold">Raporlar</h1>
        <p className="text-xs text-slate-500">Excel&apos;de açılan CSV dosyaları. Her indirme denetim kaydına yazılır.</p>
      </div>

      <div className="flex flex-wrap items-end gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm">
        <label>
          <span className="block text-xs font-medium text-slate-600">Dönem (aylık raporlar)</span>
          <input type="month" value={month} onChange={(e) => e.target.value && setMonth(e.target.value)} className="mt-1 rounded-lg border border-slate-300 px-3 py-1.5" />
        </label>
        <label>
          <span className="block text-xs font-medium text-slate-600">Aralık (liste raporları)</span>
          <select value={days} onChange={(e) => setDays(Number(e.target.value))} className="mt-1 rounded-lg border border-slate-300 px-3 py-1.5">
            <option value={30}>Son 30 gün</option>
            <option value={90}>Son 90 gün</option>
            <option value={365}>Son 1 yıl</option>
            <option value={730}>Son 2 yıl</option>
          </select>
        </label>
      </div>

      {msg && (
        <p className={`rounded-lg px-3 py-2 text-sm ${msg.kind === "ok" ? "bg-emerald-50 text-emerald-800" : "bg-red-50 text-red-700"}`}>{msg.text}</p>
      )}

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {REPORTS.map((r) => (
          <section key={r.kind} className="flex flex-col rounded-xl border border-slate-200 bg-white p-4">
            <div className="flex items-start gap-3">
              <FileSpreadsheet className="mt-0.5 shrink-0 text-emerald-600" size={20} />
              <div className="min-w-0">
                <h2 className="font-semibold">{r.title}</h2>
                <p className="text-xs text-slate-500">{r.description}</p>
                {r.personal && <p className="mt-1 text-[11px] text-amber-700">{r.personal}</p>}
              </div>
            </div>
            <button
              onClick={() => download(r.kind, r.param)}
              disabled={busy !== null}
              className="mt-3 flex items-center justify-center gap-2 self-start rounded-lg bg-brand-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-60"
            >
              <Download size={15} /> {busy === r.kind ? "Hazırlanıyor…" : "İndir"}
            </button>
          </section>
        ))}
      </div>
    </div>
  );
}
