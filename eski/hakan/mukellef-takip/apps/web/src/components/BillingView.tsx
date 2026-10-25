"use client";

import { useCallback, useEffect, useState } from "react";
import { Check, CreditCard, RefreshCw, ShieldCheck } from "lucide-react";
import { api, type Me } from "@/lib/api";

interface Overview {
  provider: "demo" | "iyzico";
  sandbox: boolean | null;
  providerConfigured: boolean;
  profileComplete: boolean;
  subscription: { plan: string; planName: string; companyQuota: number; expiresAt: string; daysLeft: number; used: number } | null;
  plans: {
    key: string;
    name: string;
    companyQuota: number;
    monthlyPrice: number;
    fitsCurrent: boolean;
    prices: { months: number; discount: number; amount: number }[];
  }[];
  payments: {
    id: string;
    plan: string;
    months: number;
    amount: number;
    currency: string;
    status: "PENDING" | "PAID" | "FAILED";
    provider: string;
    createdAt: string;
    paidAt: string | null;
    error: string | null;
    fraudStatus: number | null;
  }[];
}

interface Profile {
  billingName: string | null;
  billingContactName: string | null;
  billingTaxNumber: string | null;
  billingTaxOffice: string | null;
  billingAddress: string | null;
  billingCity: string | null;
  billingEmail: string | null;
  billingPhone: string | null;
  complete: boolean;
}

const tl = (n: number) => n.toLocaleString("tr-TR", { style: "currency", currency: "TRY" });

// iyzico'dan dönüşte /odeme?odeme=... ile gelinir; sonuç her zaman sunucu tarafından iyzico'ya sorularak belirlenmiştir
const RETURN_MESSAGES: Record<string, { kind: "ok" | "err" | "info"; text: string }> = {
  basarili: { kind: "ok", text: "Ödeme alındı, lisansınız uzatıldı." },
  inceleniyor: { kind: "info", text: "Ödemeniz iyzico tarafından inceleniyor. Onaylanınca lisansınız uzatılır; durumu aşağıdan yenileyebilirsiniz." },
  basarisiz: { kind: "err", text: "Ödeme tamamlanamadı. Kartınızdan çekim yapıldıysa iade edilir; ayrıntı ödeme geçmişinde." },
  kontrol: { kind: "info", text: "Ödeme sonucu henüz doğrulanamadı. Birazdan ödeme geçmişinden durumu yenileyin." },
  bilinmiyor: { kind: "err", text: "Ödeme bulunamadı." },
};

function paymentStatus(p: Overview["payments"][number]) {
  if (p.status === "PAID") return "Ödendi";
  if (p.status === "FAILED") return "Başarısız / iptal";
  if (p.provider === "iyzico" && p.fraudStatus === 0) return "İnceleniyor";
  return "Bekliyor";
}

export default function BillingView({ returnStatus }: { returnStatus?: string }) {
  const [data, setData] = useState<Overview | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [months, setMonths] = useState(12);
  const [pending, setPending] = useState<{ id: string; amount: number; planName: string } | null>(null);
  const [msg, setMsg] = useState<{ kind: "ok" | "err" | "info"; text: string } | null>(
    returnStatus ? (RETURN_MESSAGES[returnStatus] ?? null) : null,
  );
  const [busy, setBusy] = useState(false);
  const [showProfile, setShowProfile] = useState(false);

  const load = useCallback(
    (isAlive: () => boolean = () => true) =>
      Promise.all([api<Overview>("/billing"), api<Me>("/auth/me")]).then(([o, m]) => {
        if (!isAlive()) return;
        setData(o);
        setIsAdmin(m.role === "ADMIN");
      }),
    [],
  );

  useEffect(() => {
    let alive = true;
    load(() => alive).catch((e) => alive && setMsg({ kind: "err", text: e.message }));
    // Sonuç parametresini adres çubuğundan temizle (yenilemede mesaj tekrarlanmasın)
    if (new URLSearchParams(window.location.search).has("odeme")) window.history.replaceState(null, "", "/odeme");
    return () => {
      alive = false;
    };
  }, [load]);

  async function checkout(planKey: string, planName: string) {
    if (data?.provider === "iyzico" && !data.profileComplete) {
      setShowProfile(true);
      setMsg({ kind: "info", text: "Ödemeden önce fatura bilgilerini doldurun." });
      return;
    }
    setBusy(true);
    setMsg(null);
    try {
      // Sadece paket ve süre gönderilir; tutarı sunucu hesaplar
      const p = await api<{ id: string; amount: number; redirectUrl: string | null }>("/billing/checkout", {
        method: "POST",
        body: JSON.stringify({ plan: planKey, months }),
      });
      if (p.redirectUrl) {
        // iyzico'nun güvenli ödeme sayfası; kart bilgileri orada girilir
        window.location.assign(p.redirectUrl);
        return;
      }
      setPending({ id: p.id, amount: p.amount, planName });
      await load();
    } catch (e) {
      setMsg({ kind: "err", text: (e as Error).message });
    }
    setBusy(false);
  }

  async function confirmDemo() {
    if (!pending) return;
    setBusy(true);
    try {
      const r = await api<{ expiresAt: string }>(`/billing/payments/${pending.id}/demo-confirm`, { method: "POST" });
      setMsg({ kind: "ok", text: `Ödeme alındı (demo). Lisans ${new Date(r.expiresAt).toLocaleDateString("tr-TR")} tarihine kadar uzatıldı.` });
      setPending(null);
      await load();
    } catch (e) {
      setMsg({ kind: "err", text: (e as Error).message });
    } finally {
      setBusy(false);
    }
  }

  async function cancel(id: string) {
    await api(`/billing/payments/${id}/cancel`, { method: "POST" }).catch(() => {});
    setPending(null);
    load();
  }

  async function refresh(id: string) {
    setBusy(true);
    try {
      const r = await api<{ outcome: "PAID" | "REVIEW" | "FAILED" | "UNKNOWN" }>(`/billing/payments/${id}/refresh`, { method: "POST" });
      setMsg(
        r.outcome === "PAID"
          ? RETURN_MESSAGES.basarili
          : r.outcome === "REVIEW"
            ? { kind: "info", text: "Ödeme hâlâ iyzico incelemesinde." }
            : RETURN_MESSAGES.basarisiz,
      );
      await load();
    } catch (e) {
      setMsg({ kind: "err", text: (e as Error).message });
    } finally {
      setBusy(false);
    }
  }

  if (!data) return <p className="text-slate-500">{msg?.text ?? "Yükleniyor…"}</p>;
  const sub = data.subscription;
  const msgClass = { ok: "bg-emerald-50 text-emerald-800", err: "bg-red-50 text-red-700", info: "bg-sky-50 text-sky-900" };

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-bold">Lisans ve ödeme</h1>
        <p className="text-xs text-slate-500">Fiyatlar KDV dahildir.</p>
      </div>

      {data.provider === "demo" && (
        <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
          <b>Demo modu:</b> gerçek ödeme alınmaz. Fiyatlar örnektir.
        </p>
      )}
      {data.provider === "iyzico" && (
        <p className="flex items-start gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700">
          <ShieldCheck size={18} className="mt-0.5 shrink-0 text-emerald-600" />
          <span>
            Ödemeler <b>iyzico</b> güvenli ödeme sayfasında alınır; kart bilgileriniz bu portala gelmez ve saklanmaz.
            {data.sandbox && <b className="text-amber-700"> Test ortamı (sandbox): gerçek para çekilmez.</b>}
            {!data.providerConfigured && <b className="text-red-700"> iyzico anahtarları tanımlı değil.</b>}
          </span>
        </p>
      )}
      {msg && <p className={`rounded-lg px-3 py-2 text-sm ${msgClass[msg.kind]}`}>{msg.text}</p>}

      {sub && (
        <section className="grid grid-cols-1 gap-3 rounded-2xl border border-slate-200 bg-white p-5 sm:grid-cols-3">
          <div>
            <p className="text-xs uppercase text-slate-500">Paket</p>
            <p className="text-lg font-bold">{sub.planName}</p>
          </div>
          <div>
            <p className="text-xs uppercase text-slate-500">Bitiş</p>
            <p className="text-lg font-bold">{new Date(sub.expiresAt).toLocaleDateString("tr-TR")}</p>
            <p className={`text-xs ${sub.daysLeft <= 15 ? "font-semibold text-red-700" : "text-slate-500"}`}>{sub.daysLeft} gün kaldı</p>
          </div>
          <div>
            <p className="text-xs uppercase text-slate-500">Firma kotası</p>
            <p className="text-lg font-bold">{sub.used} / {sub.companyQuota}</p>
            <div className="mt-1 h-2 rounded-full bg-slate-100">
              <div className={`h-2 rounded-full ${sub.used / sub.companyQuota > 0.9 ? "bg-red-500" : "bg-emerald-500"}`} style={{ width: `${Math.min(100, (sub.used / sub.companyQuota) * 100)}%` }} />
            </div>
          </div>
        </section>
      )}

      {isAdmin && data.provider === "iyzico" && (
        <section className="rounded-2xl border border-slate-200 bg-white p-5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h2 className="font-semibold">Fatura bilgileri</h2>
              <p className="text-xs text-slate-500">{data.profileComplete ? "Tamam. Ödemede iyzico'ya alıcı bilgisi olarak gönderilir." : "Eksik — ödeme için gerekli."}</p>
            </div>
            <button onClick={() => setShowProfile(!showProfile)} className="rounded-lg px-3 py-1.5 text-sm font-semibold text-brand-700 hover:bg-brand-50">
              {showProfile ? "Kapat" : data.profileComplete ? "Düzenle" : "Doldur"}
            </button>
          </div>
          {showProfile && (
            <ProfileForm
              onSaved={() => {
                setShowProfile(false);
                setMsg({ kind: "ok", text: "Fatura bilgileri kaydedildi." });
                load();
              }}
            />
          )}
        </section>
      )}

      {pending && data.provider === "demo" && (
        <section className="space-y-3 rounded-2xl border border-brand-200 bg-brand-50 p-5">
          <h2 className="font-semibold">Ödeme: {pending.planName}, {months} ay — {tl(pending.amount)}</h2>
          <div className="flex flex-wrap gap-2">
            <button onClick={confirmDemo} disabled={busy} className="flex items-center gap-2 rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-60">
              <CreditCard size={16} /> Demo ödemeyi onayla
            </button>
            <button onClick={() => cancel(pending.id)} className="rounded-lg px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-white">Vazgeç</button>
          </div>
        </section>
      )}

      <section className="space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="font-semibold">Paketler</h2>
          <div className="ml-auto flex gap-1 rounded-lg bg-slate-100 p-1 text-sm">
            {[1, 6, 12].map((m) => (
              <button key={m} onClick={() => setMonths(m)} className={`rounded-md px-3 py-1 ${months === m ? "bg-white font-semibold shadow-sm" : "text-slate-600"}`}>
                {m === 1 ? "Aylık" : `${m} ay`}
                {m > 1 && <span className="ml-1 text-xs text-emerald-700">-%{m === 6 ? 5 : 15}</span>}
              </button>
            ))}
          </div>
        </div>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
          {data.plans.map((p) => {
            const price = p.prices.find((x) => x.months === months)!;
            const current = sub?.plan === p.key;
            return (
              <div key={p.key} className={`flex flex-col rounded-2xl border bg-white p-5 ${current ? "border-emerald-400 ring-1 ring-emerald-200" : "border-slate-200"}`}>
                <p className="flex items-center justify-between font-bold">
                  {p.name} {current && <span className="rounded-full bg-emerald-100 px-2 text-xs font-semibold text-emerald-800">Mevcut</span>}
                </p>
                <p className="mt-2 text-2xl font-extrabold">{tl(price.amount)}</p>
                <p className="text-xs text-slate-500">{months} ay · aylık {tl(price.amount / months)}</p>
                <p className="mt-3 flex items-center gap-1 text-sm"><Check size={14} className="text-emerald-600" /> {p.companyQuota} firmaya kadar</p>
                <p className="flex items-center gap-1 text-sm"><Check size={14} className="text-emerald-600" /> Tüm modüller</p>
                {!p.fitsCurrent && <p className="mt-2 text-xs text-red-700">Portaldaki firma sayınız bu paketin kotasını aşıyor.</p>}
                {isAdmin && (
                  <button
                    onClick={() => checkout(p.key, p.name)}
                    disabled={busy || !p.fitsCurrent || !!pending || !data.providerConfigured}
                    className="mt-4 rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-50"
                  >
                    {busy ? "Yönlendiriliyor…" : current ? "Süreyi uzat" : "Bu pakete geç"}
                  </button>
                )}
              </div>
            );
          })}
        </div>
        {!isAdmin && <p className="text-xs text-slate-500">Ödeme işlemlerini büro yöneticisi yapabilir.</p>}
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-5">
        <h2 className="mb-2 font-semibold">Ödeme geçmişi</h2>
        {data.payments.length === 0 ? (
          <p className="text-sm text-slate-500">Henüz ödeme yok.</p>
        ) : (
          <table className="w-full text-sm">
            <thead className="text-left text-xs uppercase text-slate-500">
              <tr>
                <th className="py-2">Tarih</th>
                <th className="py-2">Paket</th>
                <th className="py-2">Tutar</th>
                <th className="py-2">Durum</th>
                <th className="py-2"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {data.payments.map((p) => (
                <tr key={p.id}>
                  <td className="py-2">{new Date(p.createdAt).toLocaleDateString("tr-TR")}</td>
                  <td className="py-2">{data.plans.find((x) => x.key === p.plan)?.name ?? p.plan} · {p.months} ay</td>
                  <td className="py-2 tabular-nums">{tl(p.amount)}</td>
                  <td className="py-2">
                    {paymentStatus(p)}
                    {p.provider === "demo" && <span className="ml-1 text-xs text-slate-400">(demo)</span>}
                    {p.status === "FAILED" && p.error && <span className="block max-w-sm text-xs text-slate-500">{p.error}</span>}
                  </td>
                  <td className="py-2 text-right">
                    {isAdmin && p.status === "PENDING" && p.provider === "iyzico" && (
                      <button onClick={() => refresh(p.id)} disabled={busy} className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-semibold text-brand-700 hover:bg-brand-50 disabled:opacity-50">
                        <RefreshCw size={13} /> Durumu yenile
                      </button>
                    )}
                    {isAdmin && p.status === "PENDING" && p.provider === "demo" && (
                      <button onClick={() => cancel(p.id)} className="rounded-lg px-2 py-1 text-xs font-semibold text-slate-600 hover:bg-slate-100">İptal</button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </div>
  );
}

function ProfileForm({ onSaved }: { onSaved: () => void }) {
  const [p, setP] = useState<Profile | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    api<Profile>("/billing/profile")
      .then((r) => alive && setP(r))
      .catch((e) => alive && setError(e.message));
    return () => {
      alive = false;
    };
  }, []);

  if (!p) return error ? <p className="mt-3 text-sm text-red-700">{error}</p> : null;

  const field = (key: keyof Omit<Profile, "complete">, label: string, opts: { type?: string; span?: boolean; placeholder?: string; required?: boolean } = {}) => (
    <label className={`text-sm ${opts.span ? "sm:col-span-2" : ""}`}>
      <span className="font-medium">{label}</span>
      <input
        type={opts.type ?? "text"}
        required={opts.required !== false}
        placeholder={opts.placeholder}
        value={p[key] ?? ""}
        onChange={(e) => setP({ ...p, [key]: e.target.value })}
        className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2"
      />
    </label>
  );

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!p) return;
    setError(null);
    try {
      const body = {
        billingName: p.billingName ?? "",
        billingContactName: p.billingContactName ?? "",
        billingTaxNumber: p.billingTaxNumber ?? "",
        billingTaxOffice: p.billingTaxOffice ?? "",
        billingAddress: p.billingAddress ?? "",
        billingCity: p.billingCity ?? "",
        billingEmail: p.billingEmail ?? "",
        billingPhone: p.billingPhone ?? "",
      };
      await api("/billing/profile", { method: "PUT", body: JSON.stringify(body) });
      onSaved();
    } catch (err) {
      setError((err as Error).message);
    }
  }

  return (
    <form onSubmit={save} className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
      {field("billingName", "Unvan / ad soyad", { span: true })}
      {field("billingContactName", "Yetkili kişi (ad soyad)", { placeholder: "Ayşe Yılmaz" })}
      {field("billingTaxNumber", "VKN / TCKN")}
      {field("billingTaxOffice", "Vergi dairesi", { required: false })}
      {field("billingCity", "Şehir")}
      {field("billingAddress", "Adres", { span: true })}
      {field("billingEmail", "E-posta", { type: "email" })}
      {field("billingPhone", "Cep telefonu", { placeholder: "0532 123 45 67" })}
      {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 sm:col-span-2">{error}</p>}
      <button className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700 sm:col-span-2">Kaydet</button>
    </form>
  );
}
