"use client";

import { ArrowLeft, CalendarPlus, KeyRound, Lock, Pencil, ShieldOff, Snowflake, Sun } from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { btnDanger, btnPrimary, btnSecondary, card, ErrorBox, input, label, SecretValue, StatusBadge } from "@/components/ui";
import { api, errorText, type OfficeDetail, type OfficeUser, type Plan } from "@/lib/api";
import { actionLabel, daysLeft, formatDate, formatDateTime, formatPhone } from "@/lib/format";

type Panel = null | "edit" | "extend" | "suspend";

/** Büro ayrıntısı: yalnız hesap, lisans ve kullanıcı bilgisi (mükellef verisi satışa açık değildir). */
export default function OfficePage() {
  const { id } = useParams<{ id: string }>();
  const [o, setO] = useState<OfficeDetail | null>(null);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [panel, setPanel] = useState<Panel>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<{ text: string; secret?: string } | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => api<OfficeDetail>(`/offices/${id}`).then(setO, (e) => setError(errorText(e))), [id]);
  useEffect(() => {
    load();
    api<Plan[]>("/offices/plans").then(setPlans, () => undefined);
  }, [load]);

  const act = async (fn: () => Promise<OfficeDetail | void>, done?: string) => {
    setBusy(true);
    setError(null);
    try {
      const r = await fn();
      if (r) setO(r);
      setPanel(null);
      if (done) setNotice({ text: done });
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(false);
    }
  };

  const resetPassword = (u: OfficeUser) => {
    if (!confirm(`${u.fullName} için yeni geçici şifre üretilsin mi? Açık oturumları kapanır.`)) return;
    act(async () => {
      const r = await api<{ tempPassword: string }>(`/offices/${id}/users/${u.id}/reset-password`, { body: {} });
      setNotice({ text: `${u.fullName} için geçici şifre (bir kez gösterilir):`, secret: r.tempPassword });
      await load();
    });
  };

  const resetTwoFactor = (u: OfficeUser) => {
    if (!confirm(`${u.fullName} için iki adımlı doğrulama sıfırlansın mı? Bir sonraki girişte yeniden kuracak.`)) return;
    act(async () => {
      await api(`/offices/${id}/users/${u.id}/reset-2fa`, { body: {} });
      await load();
    }, `${u.fullName} bir sonraki girişte iki adımlı doğrulamayı yeniden kuracak.`);
  };

  if (!o) {
    return error ? <ErrorBox message={error} /> : <p className="text-slate-500">Yükleniyor…</p>;
  }

  const left = daysLeft(o.expiresAt);

  return (
    <>
      <Link href="/" className="mb-3 inline-flex items-center gap-1 text-sm font-medium text-slate-600 hover:text-brand-700">
        <ArrowLeft size={16} /> Bürolar
      </Link>
      <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="break-words text-xl font-bold text-slate-900 sm:text-2xl">{o.name}</h1>
            <StatusBadge status={o.status} />
          </div>
          <p className="mt-1 text-sm text-slate-600">Açılış: {formatDate(o.createdAt)}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button className={btnSecondary} onClick={() => setPanel(panel === "edit" ? null : "edit")}>
            <Pencil size={16} /> Düzenle
          </button>
          <button className={btnPrimary} onClick={() => setPanel(panel === "extend" ? null : "extend")}>
            <CalendarPlus size={16} /> Lisansı uzat
          </button>
          {o.suspendedAt ? (
            <button className={btnSecondary} disabled={busy} onClick={() => act(() => api(`/offices/${id}/resume`, { body: {} }), "Büro yeniden açıldı.")}>
              <Sun size={16} /> Dondurmayı kaldır
            </button>
          ) : (
            <button className={btnDanger} onClick={() => setPanel(panel === "suspend" ? null : "suspend")}>
              <Snowflake size={16} /> Dondur
            </button>
          )}
        </div>
      </div>

      <div className="space-y-4">
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

        {panel === "edit" && <EditPanel o={o} busy={busy} onCancel={() => setPanel(null)} onSave={(b) => act(() => api(`/offices/${id}`, { method: "PATCH", body: b }), "Bilgiler kaydedildi.")} />}
        {panel === "extend" && <ExtendPanel o={o} plans={plans} busy={busy} onCancel={() => setPanel(null)} onSave={(b) => act(() => api(`/offices/${id}/extend`, { body: b }), "Lisans uzatıldı.")} />}
        {panel === "suspend" && (
          <SuspendPanel busy={busy} onCancel={() => setPanel(null)} onSave={(reason) => act(() => api(`/offices/${id}/suspend`, { body: { reason } }), "Büro donduruldu; kullanıcıların oturumları kapandı.")} />
        )}

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <section className={`${card} p-5`}>
            <h2 className="mb-3 font-semibold text-slate-900">Yetkili</h2>
            <dl className="grid grid-cols-[110px_minmax(0,1fr)] gap-y-2 text-sm">
              <dt className="text-slate-500">Ad soyad</dt>
              <dd className="break-words">{o.contactName ?? "—"}</dd>
              <dt className="text-slate-500">E-posta</dt>
              <dd className="break-all">{o.contactEmail ?? "—"}</dd>
              <dt className="text-slate-500">Telefon</dt>
              <dd>{formatPhone(o.contactPhone)}</dd>
            </dl>
          </section>
          <section className={`${card} p-5`}>
            <h2 className="mb-3 font-semibold text-slate-900">Lisans</h2>
            <dl className="grid grid-cols-[110px_minmax(0,1fr)] gap-y-2 text-sm">
              <dt className="text-slate-500">Paket</dt>
              <dd>{plans.find((p) => p.key === o.plan)?.name ?? o.plan ?? "—"}</dd>
              <dt className="text-slate-500">Bitiş</dt>
              <dd>
                {formatDate(o.expiresAt)}
                {left !== null && <span className={`ml-2 text-xs font-semibold ${left < 0 ? "text-red-700" : left <= 7 ? "text-amber-700" : "text-slate-500"}`}>{left < 0 ? `${-left} gün geçti` : `${left} gün kaldı`}</span>}
              </dd>
              <dt className="text-slate-500">Deneme sonu</dt>
              <dd>{formatDate(o.trialEndsAt)}</dd>
              <dt className="text-slate-500">Mükellef</dt>
              <dd>
                {o.companyCount} / {o.companyQuota ?? "—"}
              </dd>
              {o.suspendedAt && (
                <>
                  <dt className="text-slate-500">Donduruldu</dt>
                  <dd>{formatDateTime(o.suspendedAt)}</dd>
                </>
              )}
            </dl>
          </section>
        </div>

        <section className={card}>
          <h2 className="px-5 pt-5 pb-3 font-semibold text-slate-900">Büro kullanıcıları</h2>
          <div className="table-scroll overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-y border-slate-200 bg-slate-50 text-xs font-semibold text-slate-600 uppercase">
                <tr>
                  <th className="px-5 py-2.5">Kullanıcı</th>
                  <th className="px-5 py-2.5">Rol</th>
                  <th className="px-5 py-2.5">Durum</th>
                  <th className="px-5 py-2.5">Son giriş</th>
                  <th className="px-5 py-2.5 text-right">İşlem</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {o.users.map((u) => (
                  <tr key={u.id}>
                    <td className="px-5 py-3">
                      <div className="font-medium text-slate-900">{u.fullName}</div>
                      <div className="text-xs text-slate-500">{u.email}</div>
                    </td>
                    <td className="px-5 py-3">{u.role === "ADMIN" ? "Yönetici" : "Personel"}</td>
                    <td className="px-5 py-3">
                      <div className="flex flex-wrap gap-1 text-xs">
                        <Tag on={u.isActive} yes="Aktif" no="Kapalı" />
                        <Tag on={u.twoFactorEnabled} yes="2FA açık" no="2FA yok" />
                        {u.mustChangePassword && <span className="rounded bg-amber-50 px-1.5 py-0.5 font-medium text-amber-800">Geçici şifre</span>}
                        {u.locked && (
                          <span className="inline-flex items-center gap-1 rounded bg-red-50 px-1.5 py-0.5 font-medium text-red-700">
                            <Lock size={12} /> Kilitli
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-5 py-3">{formatDateTime(u.lastLoginAt)}</td>
                    <td className="px-5 py-3">
                      <div className="flex justify-end gap-1">
                        <button className="rounded-lg p-2 text-slate-600 hover:bg-orange-50 hover:text-brand-700" title="Şifre sıfırla" aria-label={`${u.fullName} şifre sıfırla`} disabled={busy} onClick={() => resetPassword(u)}>
                          <KeyRound size={16} />
                        </button>
                        <button
                          className="rounded-lg p-2 text-slate-600 hover:bg-orange-50 hover:text-brand-700 disabled:opacity-40"
                          title="İki adımlı doğrulamayı sıfırla"
                          aria-label={`${u.fullName} iki adımlı doğrulamayı sıfırla`}
                          disabled={busy || !u.twoFactorEnabled}
                          onClick={() => resetTwoFactor(u)}
                        >
                          <ShieldOff size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className={`${card} p-5`}>
          <h2 className="mb-3 font-semibold text-slate-900">Satış işlemleri</h2>
          {o.history.length === 0 ? (
            <p className="text-sm text-slate-500">Kayıt yok</p>
          ) : (
            <ol className="space-y-2 text-sm">
              {o.history.map((h) => (
                <li key={h.id} className="flex flex-wrap gap-x-3 gap-y-0.5 border-b border-slate-100 pb-2 last:border-0">
                  <span className="w-36 shrink-0 text-slate-500">{formatDateTime(h.createdAt)}</span>
                  <span className="font-medium text-slate-800">{actionLabel(h.action)}</span>
                  {h.by && <span className="text-slate-500">· {h.by}</span>}
                </li>
              ))}
            </ol>
          )}
        </section>
      </div>
    </>
  );
}

function Tag({ on, yes, no }: { on: boolean; yes: string; no: string }) {
  return <span className={`rounded px-1.5 py-0.5 font-medium ${on ? "bg-emerald-50 text-emerald-800" : "bg-slate-100 text-slate-600"}`}>{on ? yes : no}</span>;
}

function PanelBox({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className={`${card} border-brand-200 p-5`}>
      <h2 className="mb-3 font-semibold text-slate-900">{title}</h2>
      {children}
    </section>
  );
}

function EditPanel({ o, busy, onCancel, onSave }: { o: OfficeDetail; busy: boolean; onCancel: () => void; onSave: (b: Record<string, string>) => void }) {
  const [f, setF] = useState({ officeName: o.name, contactName: o.contactName ?? "", contactEmail: o.contactEmail ?? "", contactPhone: o.contactPhone ? `0${o.contactPhone.slice(2)}` : "" });
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement>) => setF({ ...f, [k]: e.target.value });
  return (
    <PanelBox title="Bilgileri düzenle">
      <form
        className="grid grid-cols-1 gap-3 md:grid-cols-2"
        onSubmit={(e) => {
          e.preventDefault();
          // Yalnız dolu alanlar gönderilir
          onSave(Object.fromEntries(Object.entries(f).filter(([, v]) => v.trim())));
        }}
      >
        <div className="md:col-span-2">
          <label className={label} htmlFor="e-name">
            Büro adı
          </label>
          <input id="e-name" className={input} value={f.officeName} onChange={set("officeName")} minLength={2} />
        </div>
        <div>
          <label className={label} htmlFor="e-contact">
            Yetkili
          </label>
          <input id="e-contact" className={input} value={f.contactName} onChange={set("contactName")} />
        </div>
        <div>
          <label className={label} htmlFor="e-phone">
            Telefon
          </label>
          <input id="e-phone" type="tel" className={input} value={f.contactPhone} onChange={set("contactPhone")} />
        </div>
        <div className="md:col-span-2">
          <label className={label} htmlFor="e-email">
            İletişim e-postası
          </label>
          <input id="e-email" type="email" className={input} value={f.contactEmail} onChange={set("contactEmail")} />
          <p className="mt-1 text-xs text-slate-500">Müşavirin giriş e-postası değişmez; bu yalnız iletişim adresidir.</p>
        </div>
        <div className="flex gap-2 md:col-span-2">
          <button className={btnPrimary} disabled={busy}>
            Kaydet
          </button>
          <button type="button" className={btnSecondary} onClick={onCancel}>
            Vazgeç
          </button>
        </div>
      </form>
    </PanelBox>
  );
}

function ExtendPanel({ o, plans, busy, onCancel, onSave }: { o: OfficeDetail; plans: Plan[]; busy: boolean; onCancel: () => void; onSave: (b: object) => void }) {
  const [unit, setUnit] = useState<"months" | "days">("months");
  const [months, setMonths] = useState(12);
  const [days, setDays] = useState(14);
  const [plan, setPlan] = useState(o.plan ?? "baslangic");
  return (
    <PanelBox title="Lisansı uzat">
      <p className="mb-3 text-sm text-slate-600">Süre bitmemişse bitiş tarihinin üzerine, bittiyse bugünden itibaren eklenir.</p>
      <form
        className="grid grid-cols-1 gap-3 md:grid-cols-3"
        onSubmit={(e) => {
          e.preventDefault();
          onSave(unit === "months" ? { months, plan } : { days, plan });
        }}
      >
        <div>
          <label className={label} htmlFor="x-unit">
            Süre türü
          </label>
          <select id="x-unit" className={input} value={unit} onChange={(e) => setUnit(e.target.value as "months" | "days")}>
            <option value="months">Ay (ödeme sonrası)</option>
            <option value="days">Gün (ek deneme)</option>
          </select>
        </div>
        <div>
          {unit === "months" ? (
            <>
              <label className={label} htmlFor="x-months">
                Ay
              </label>
              <select id="x-months" className={input} value={months} onChange={(e) => setMonths(Number(e.target.value))}>
                {[1, 6, 12].map((m) => (
                  <option key={m} value={m}>
                    {m} ay
                  </option>
                ))}
              </select>
            </>
          ) : (
            <>
              <label className={label} htmlFor="x-days">
                Gün
              </label>
              <input id="x-days" type="number" min={1} max={90} className={input} value={days} onChange={(e) => setDays(Number(e.target.value))} />
            </>
          )}
        </div>
        <div>
          <label className={label} htmlFor="x-plan">
            Paket
          </label>
          <select id="x-plan" className={input} value={plan} onChange={(e) => setPlan(e.target.value)}>
            {plans.map((p) => (
              <option key={p.key} value={p.key}>
                {p.name} ({p.companyQuota} mükellef)
              </option>
            ))}
          </select>
        </div>
        <div className="flex gap-2 md:col-span-3">
          <button className={btnPrimary} disabled={busy}>
            Uzat
          </button>
          <button type="button" className={btnSecondary} onClick={onCancel}>
            Vazgeç
          </button>
        </div>
      </form>
    </PanelBox>
  );
}

function SuspendPanel({ busy, onCancel, onSave }: { busy: boolean; onCancel: () => void; onSave: (reason: string) => void }) {
  const [reason, setReason] = useState("");
  return (
    <PanelBox title="Büroyu dondur">
      <p className="mb-3 text-sm text-slate-600">
        Büronun tüm aktif kullanıcıları kapatılır ve açık oturumları hemen düşer. Veriler silinmez; dondurma kaldırılınca aynı kullanıcılar geri açılır.
      </p>
      <form
        className="space-y-3"
        onSubmit={(e) => {
          e.preventDefault();
          onSave(reason);
        }}
      >
        <div>
          <label className={label} htmlFor="s-reason">
            Neden (isteğe bağlı)
          </label>
          <input id="s-reason" className={input} value={reason} onChange={(e) => setReason(e.target.value)} maxLength={300} placeholder="ör. Ödeme yapılmadı" />
        </div>
        <div className="flex gap-2">
          <button className={btnDanger} disabled={busy}>
            <Snowflake size={16} /> Dondur
          </button>
          <button type="button" className={btnSecondary} onClick={onCancel}>
            Vazgeç
          </button>
        </div>
      </form>
    </PanelBox>
  );
}
