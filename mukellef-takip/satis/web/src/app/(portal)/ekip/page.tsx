"use client";

import { KeyRound, ShieldOff, UserPlus } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { btnPrimary, card, ErrorBox, input, label, PageTitle, SecretValue } from "@/components/ui";
import { api, errorText, type TeamMember } from "@/lib/api";
import { formatDateTime } from "@/lib/format";

/** Satış ekibi: ekip arkadaşı ekleme, kapatma, şifre ve iki adımlı doğrulama sıfırlama. */
export default function TeamPage() {
  const [rows, setRows] = useState<TeamMember[] | null>(null);
  const [form, setForm] = useState({ email: "", fullName: "" });
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<{ text: string; secret?: string } | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => api<TeamMember[]>("/team").then(setRows, (e) => setError(errorText(e))), []);
  useEffect(() => {
    load();
  }, [load]);

  const act = async (fn: () => Promise<void>) => {
    setBusy(true);
    setError(null);
    try {
      await fn();
      await load();
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(false);
    }
  };

  const add = (e: React.FormEvent) => {
    e.preventDefault();
    act(async () => {
      const r = await api<{ email: string; tempPassword: string }>("/team", { body: form });
      setNotice({ text: `${r.email} eklendi. Geçici şifre (bir kez gösterilir):`, secret: r.tempPassword });
      setForm({ email: "", fullName: "" });
    });
  };

  return (
    <>
      <PageTitle title="Satış ekibi" subtitle="Satış portalına girebilen kişiler. Her girişte iki adımlı doğrulama istenir." />
      <div className="space-y-4">
        <form onSubmit={add} className={`${card} grid grid-cols-1 gap-3 p-5 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto] md:items-end`}>
          <div>
            <label className={label} htmlFor="t-name">
              Ad soyad
            </label>
            <input id="t-name" className={input} value={form.fullName} onChange={(e) => setForm({ ...form, fullName: e.target.value })} required minLength={2} />
          </div>
          <div>
            <label className={label} htmlFor="t-email">
              E-posta
            </label>
            <input id="t-email" type="email" className={input} value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required />
          </div>
          <button className={btnPrimary} disabled={busy}>
            <UserPlus size={16} /> Ekle
          </button>
        </form>

        <ErrorBox message={error} />
        {notice && (
          <div className="flex flex-wrap items-center gap-3 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
            <span>{notice.text}</span>
            {notice.secret && <SecretValue value={notice.secret} />}
            <button className="ml-auto text-xs font-semibold underline" onClick={() => setNotice(null)}>
              Kapat
            </button>
          </div>
        )}

        <div className={`${card} table-scroll overflow-x-auto`}>
          <table className="w-full text-left text-sm">
            <thead className="border-b border-slate-200 bg-slate-50 text-xs font-semibold text-slate-600 uppercase">
              <tr>
                <th className="px-4 py-3">Kişi</th>
                <th className="px-4 py-3">Durum</th>
                <th className="px-4 py-3">Son giriş</th>
                <th className="px-4 py-3 text-right">İşlem</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {rows?.map((u) => (
                <tr key={u.id}>
                  <td className="px-4 py-3">
                    <div className="font-medium text-slate-900">
                      {u.fullName} {u.isMe && <span className="text-xs font-normal text-slate-500">(siz)</span>}
                    </div>
                    <div className="text-xs text-slate-500">{u.email}</div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-1 text-xs">
                      <span className={`rounded px-1.5 py-0.5 font-medium ${u.isActive ? "bg-emerald-50 text-emerald-800" : "bg-slate-100 text-slate-600"}`}>{u.isActive ? "Aktif" : "Kapalı"}</span>
                      {!u.twoFactorEnabled && <span className="rounded bg-sky-50 px-1.5 py-0.5 font-medium text-sky-800">İlk giriş bekleniyor</span>}
                      {u.locked && <span className="rounded bg-red-50 px-1.5 py-0.5 font-medium text-red-700">Kilitli</span>}
                    </div>
                  </td>
                  <td className="px-4 py-3">{formatDateTime(u.lastLoginAt)}</td>
                  <td className="px-4 py-3">
                    {!u.isMe && (
                      <div className="flex items-center justify-end gap-1">
                        <button
                          className="rounded-lg p-2 text-slate-600 hover:bg-orange-50 hover:text-brand-700"
                          title="Şifre sıfırla"
                          aria-label={`${u.fullName} şifre sıfırla`}
                          disabled={busy}
                          onClick={() =>
                            confirm(`${u.fullName} için yeni geçici şifre üretilsin mi?`) &&
                            act(async () => {
                              const r = await api<{ tempPassword: string }>(`/team/${u.id}/reset-password`, { body: {} });
                              setNotice({ text: `${u.fullName} için geçici şifre:`, secret: r.tempPassword });
                            })
                          }
                        >
                          <KeyRound size={16} />
                        </button>
                        <button
                          className="rounded-lg p-2 text-slate-600 hover:bg-orange-50 hover:text-brand-700 disabled:opacity-40"
                          title="İki adımlı doğrulamayı sıfırla"
                          aria-label={`${u.fullName} iki adımlı doğrulamayı sıfırla`}
                          disabled={busy || !u.twoFactorEnabled}
                          onClick={() =>
                            confirm(`${u.fullName} iki adımlı doğrulamayı yeniden kursun mu?`) &&
                            act(async () => {
                              await api(`/team/${u.id}/reset-2fa`, { body: {} });
                              setNotice({ text: `${u.fullName} bir sonraki girişte iki adımlı doğrulamayı yeniden kuracak.` });
                            })
                          }
                        >
                          <ShieldOff size={16} />
                        </button>
                        <button
                          className="ml-1 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-slate-700 ring-1 ring-slate-200 hover:bg-slate-50"
                          disabled={busy}
                          onClick={() => act(async () => void (await api(`/team/${u.id}`, { method: "PATCH", body: { isActive: !u.isActive } })))}
                        >
                          {u.isActive ? "Kapat" : "Aç"}
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
