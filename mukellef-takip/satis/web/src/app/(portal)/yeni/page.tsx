"use client";

import { CheckCircle2, UserPlus } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { btnPrimary, btnSecondary, card, ErrorBox, input, label, PageTitle, SecretValue } from "@/components/ui";
import { api, errorText, type Plan } from "@/lib/api";
import { formatDate } from "@/lib/format";

interface Created {
  id: string;
  loginEmail: string;
  tempPassword: string;
  trialEndsAt: string;
}

const EMPTY = { officeName: "", contactName: "", email: "", phone: "", plan: "baslangic", trialDays: 14 };

/**
 * Yeni müşavir kaydı. Bilgiler müşavirden ya da satış ekibinden gelir; kayıttan sonra geçici şifre bir kez gösterilir,
 * kurulum günü müşaviri arayıp verilir. Müşavir ilk girişte şifresini değiştirir; iki adımlı doğrulama isteğe bağlıdır.
 */
export default function NewOfficePage() {
  const [form, setForm] = useState(EMPTY);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [created, setCreated] = useState<Created | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api<Plan[]>("/offices/plans").then(setPlans, (e) => setError(errorText(e)));
  }, []);

  const set = (k: keyof typeof EMPTY) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setForm({ ...form, [k]: k === "trialDays" ? Number(e.target.value) : e.target.value });

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      setCreated(await api<Created>("/offices", { body: form }));
    } catch (err) {
      setError(errorText(err));
    } finally {
      setBusy(false);
    }
  };

  if (created) {
    return (
      <div className={`${card} mx-auto max-w-2xl p-6 sm:p-8`}>
        <div className="flex items-start gap-3">
          <CheckCircle2 className="mt-0.5 shrink-0 text-emerald-600" />
          <div className="min-w-0">
            <h1 className="text-xl font-bold text-slate-900">Müşavir hesabı açıldı</h1>
            <p className="mt-1 text-sm text-slate-600">Deneme süresi {formatDate(created.trialEndsAt)} tarihinde biter.</p>
          </div>
        </div>
        <dl className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-[140px_minmax(0,1fr)] sm:items-center">
          <dt className="text-sm font-medium text-slate-600">Giriş e-postası</dt>
          <dd className="break-all font-semibold text-slate-900">{created.loginEmail}</dd>
          <dt className="text-sm font-medium text-slate-600">Geçici şifre</dt>
          <dd>
            <SecretValue value={created.tempPassword} />
          </dd>
        </dl>
        <p className="mt-5 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-900">
          Geçici şifre bir daha gösterilmez. Kurulum günü müşaviri arayıp iletin; ilk girişte kendi şifresini belirleyecek. İki adımlı doğrulamayı kurmasını önerin; kurmazsa girişte güvenlik kodu sorulur.
          Şifre kaybolursa büro sayfasından sıfırlayabilirsiniz.
        </p>
        <div className="mt-6 flex flex-wrap gap-2">
          <Link href={`/buro/${created.id}`} className={btnPrimary}>
            Büroya git
          </Link>
          <button
            className={btnSecondary}
            onClick={() => {
              setCreated(null);
              setForm(EMPTY);
            }}
          >
            <UserPlus size={16} /> Başka müşavir ekle
          </button>
        </div>
      </div>
    );
  }

  return (
    <>
      <PageTitle title="Yeni müşavir ekle" subtitle="Müşavirin bürosu ve yönetici hesabı birlikte açılır." />
      <form onSubmit={submit} className={`${card} max-w-3xl space-y-5 p-5 sm:p-6`}>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div className="md:col-span-2">
            <label htmlFor="officeName" className={label}>
              Büro adı (unvan)
            </label>
            <input id="officeName" className={input} value={form.officeName} onChange={set("officeName")} placeholder="ör. Yılmaz Mali Müşavirlik" required minLength={2} />
          </div>
          <div>
            <label htmlFor="contactName" className={label}>
              Müşavirin adı soyadı
            </label>
            <input id="contactName" className={input} value={form.contactName} onChange={set("contactName")} autoComplete="off" required minLength={2} />
          </div>
          <div>
            <label htmlFor="phone" className={label}>
              Telefon
            </label>
            <input id="phone" type="tel" className={input} value={form.phone} onChange={set("phone")} placeholder="0532 123 45 67" autoComplete="off" required />
          </div>
          <div className="md:col-span-2">
            <label htmlFor="email" className={label}>
              E-posta (giriş adresi olur)
            </label>
            <input id="email" type="email" className={input} value={form.email} onChange={set("email")} autoComplete="off" required />
          </div>
          <div>
            <label htmlFor="plan" className={label}>
              Paket
            </label>
            <select id="plan" className={input} value={form.plan} onChange={set("plan")}>
              {plans.map((p) => (
                <option key={p.key} value={p.key}>
                  {p.name} ({p.companyQuota} mükellef)
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="trialDays" className={label}>
              Deneme süresi (gün)
            </label>
            <input id="trialDays" type="number" className={input} value={form.trialDays} onChange={set("trialDays")} min={1} max={90} required />
          </div>
        </div>
        <p className="text-xs text-slate-500">GİB kullanıcı bilgileri bu formda alınmaz (ekip kararı bekleniyor).</p>
        <ErrorBox message={error} />
        <div className="flex flex-wrap gap-2">
          <button className={btnPrimary} disabled={busy}>
            <UserPlus size={16} /> Hesabı aç
          </button>
          <Link href="/" className={btnSecondary}>
            Vazgeç
          </Link>
        </div>
      </form>
    </>
  );
}
