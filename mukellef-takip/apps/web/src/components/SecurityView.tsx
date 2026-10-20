"use client";

import { useEffect, useState } from "react";
import { ShieldCheck, ShieldOff } from "lucide-react";
import { api, setToken, type Me } from "@/lib/api";

const input = "mt-1 w-full rounded-lg border border-slate-300 px-3 py-2";

function Msg({ m }: { m: { kind: "ok" | "err"; text: string } | null }) {
  if (!m) return null;
  return <p className={`rounded-lg px-3 py-2 text-sm ${m.kind === "ok" ? "bg-emerald-50 text-emerald-800" : "bg-red-50 text-red-700"}`}>{m.text}</p>;
}

/** Şifre değiştirme ve iki adımlı doğrulama (TOTP) kurulumu. */
export default function SecurityView() {
  const [me, setMe] = useState<Me | null>(null);

  const reload = () => api<Me>("/auth/me").then(setMe);
  useEffect(() => {
    let alive = true;
    api<Me>("/auth/me").then((m) => alive && setMe(m)).catch(() => {});
    return () => {
      alive = false;
    };
  }, []);

  if (!me) return null;
  return (
    <div className="max-w-2xl space-y-4">
      <h1 className="text-xl font-bold">Güvenlik</h1>
      <PasswordSection />
      <TwoFactorSection me={me} onChanged={reload} />
    </div>
  );
}

function PasswordSection() {
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [msg, setMsg] = useState<{ kind: "ok" | "err"; text: string } | null>(null);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setMsg(null);
    try {
      const r = await api<{ accessToken: string }>("/auth/password", {
        method: "POST",
        body: JSON.stringify({ currentPassword: current, newPassword: next }),
      });
      setToken(r.accessToken);
      setCurrent("");
      setNext("");
      setMsg({ kind: "ok", text: "Şifre değişti. Diğer cihazlardaki oturumlarınız kapatıldı." });
    } catch (err) {
      setMsg({ kind: "err", text: (err as Error).message });
    }
  }

  return (
    <form onSubmit={save} className="space-y-3 rounded-2xl border border-slate-200 bg-white p-5">
      <h2 className="font-semibold">Şifre değiştir</h2>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <label className="text-sm">
          <span className="font-medium">Mevcut şifre</span>
          <input type="password" required autoComplete="current-password" value={current} onChange={(e) => setCurrent(e.target.value)} className={input} />
        </label>
        <label className="text-sm">
          <span className="font-medium">Yeni şifre</span>
          <input type="password" required autoComplete="new-password" value={next} onChange={(e) => setNext(e.target.value)} className={input} />
        </label>
      </div>
      <p className="text-xs text-slate-500">En az 10 karakter; harf ve rakam içermeli.</p>
      <Msg m={msg} />
      <button className="rounded-lg bg-slate-800 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-900">Şifreyi değiştir</button>
    </form>
  );
}

/** onDone: kurtarma kodları kaydedildikten sonra çağrılır (zorunlu kurulum ekranı buradan portala geçer) */
export function TwoFactorSection({ me, onChanged, onDone }: { me: Me; onChanged: () => void; onDone?: () => void }) {
  const [setup, setSetup] = useState<{ secret: string; qrDataUrl: string } | null>(null);
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const [recovery, setRecovery] = useState<string[] | null>(null);
  const [msg, setMsg] = useState<{ kind: "ok" | "err"; text: string } | null>(null);

  async function start() {
    setMsg(null);
    try {
      setSetup(await api("/auth/2fa/setup", { method: "POST" }));
    } catch (err) {
      setMsg({ kind: "err", text: (err as Error).message });
    }
  }

  async function enable(e: React.FormEvent) {
    e.preventDefault();
    setMsg(null);
    try {
      const r = await api<{ recoveryCodes: string[]; accessToken: string }>("/auth/2fa/enable", { method: "POST", body: JSON.stringify({ code }) });
      setToken(r.accessToken);
      setRecovery(r.recoveryCodes);
      setSetup(null);
      setCode("");
      onChanged();
    } catch (err) {
      setMsg({ kind: "err", text: (err as Error).message });
    }
  }

  async function disable(e: React.FormEvent) {
    e.preventDefault();
    setMsg(null);
    try {
      const r = await api<{ accessToken: string }>("/auth/2fa/disable", { method: "POST", body: JSON.stringify({ password, code }) });
      setToken(r.accessToken);
      setPassword("");
      setCode("");
      setMsg({ kind: "ok", text: "İki adımlı doğrulama kapatıldı." });
      onChanged();
    } catch (err) {
      setMsg({ kind: "err", text: (err as Error).message });
    }
  }

  function downloadCodes() {
    if (!recovery) return;
    const text = `Mükellef Takip — kurtarma kodları (${me.email})\nHer kod bir kez kullanılabilir. Güvenli bir yerde saklayın.\n\n${recovery.join("\n")}\n`;
    const url = URL.createObjectURL(new Blob([text], { type: "text/plain;charset=utf-8" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = "mukellef-takip-kurtarma-kodlari.txt";
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  return (
    <section className="space-y-3 rounded-2xl border border-slate-200 bg-white p-5">
      <div className="flex items-center gap-2">
        {me.twoFactorEnabled ? <ShieldCheck className="text-emerald-600" size={20} /> : <ShieldOff className="text-slate-400" size={20} />}
        <h2 className="font-semibold">İki adımlı doğrulama</h2>
        <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${me.twoFactorEnabled ? "bg-emerald-100 text-emerald-800" : "bg-slate-100 text-slate-600"}`}>
          {me.twoFactorEnabled ? "Açık" : "Kapalı"}
        </span>
        {me.twoFactorRequired && <span className="rounded-full bg-brand-50 px-2 py-0.5 text-xs font-semibold text-brand-700">Büronuzda zorunlu</span>}
      </div>
      <p className="text-sm text-slate-600">
        Girişte şifrenin yanında telefonunuzdaki doğrulayıcı uygulamanın (Google Authenticator, Microsoft Authenticator vb.) ürettiği
        kod istenir. Kurum şifrelerini sakladığımız için yöneticilerin açması önerilir.
      </p>

      {recovery && (
        <div className="space-y-2 rounded-lg border border-amber-300 bg-amber-50 p-4">
          <p className="font-semibold text-amber-900">Kurtarma kodlarınız — bir daha gösterilmeyecek</p>
          <p className="text-xs text-amber-900">Telefonunuza erişemezseniz bu kodlardan biriyle giriş yaparsınız. Her kod bir kez kullanılır.</p>
          <div className="grid grid-cols-2 gap-1 font-mono text-sm sm:grid-cols-5">
            {recovery.map((c) => (
              <span key={c} className="rounded bg-white px-2 py-1 text-center">{c}</span>
            ))}
          </div>
          <div className="flex gap-2">
            <button onClick={downloadCodes} className="rounded-lg bg-amber-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-amber-700">Dosya olarak indir</button>
            <button
              onClick={() => {
                setRecovery(null);
                onDone?.();
              }}
              className="rounded-lg bg-white px-3 py-1.5 text-sm font-semibold text-amber-900 ring-1 ring-amber-300"
            >
              {onDone ? "Kaydettim, portala geç" : "Kaydettim, kapat"}
            </button>
          </div>
        </div>
      )}

      {!me.twoFactorEnabled && !setup && !recovery && (
        <button onClick={start} className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700">Kurulumu başlat</button>
      )}

      {setup && (
        <form onSubmit={enable} className="grid grid-cols-1 gap-4 sm:grid-cols-[auto_minmax(0,1fr)]">
          {/* eslint-disable-next-line @next/next/no-img-element -- sunucunun ürettiği data: URL */}
          <img src={setup.qrDataUrl} alt="Doğrulayıcı uygulamayla okutulacak QR kod" width={180} height={180} className="rounded-lg border border-slate-200" />
          <div className="space-y-2 text-sm">
            <p>1. Doğrulayıcı uygulamada &quot;hesap ekle&quot; deyip QR kodu okutun.</p>
            <p className="text-xs text-slate-500">
              Okutamıyorsanız anahtarı elle girin: <code className="break-all rounded bg-slate-100 px-1">{setup.secret}</code>
            </p>
            <label className="block">
              <span>2. Uygulamanın gösterdiği 6 haneli kod</span>
              <input required inputMode="numeric" autoComplete="one-time-code" value={code} onChange={(e) => setCode(e.target.value.replace(/[^\d ]/g, "").slice(0, 7))} className={`${input} max-w-40 text-center tracking-widest`} />
            </label>
            <button className="rounded-lg bg-brand-600 px-4 py-2 font-semibold text-white hover:bg-brand-700">Doğrula ve aç</button>
          </div>
        </form>
      )}

      {me.twoFactorEnabled && !recovery && me.twoFactorRequired && (
        <p className="border-t border-slate-100 pt-3 text-sm text-slate-600">
          Kalan kurtarma kodu: <b>{me.recoveryCodesLeft}</b>. Büronuzda zorunlu olduğu için kapatılamaz; telefonunuzu değiştirirseniz yöneticiniz
          Kullanıcılar sayfasından sıfırlayabilir.
        </p>
      )}

      {me.twoFactorEnabled && !recovery && !me.twoFactorRequired && (
        <form onSubmit={disable} className="space-y-2 border-t border-slate-100 pt-3">
          <p className="text-sm text-slate-600">Kalan kurtarma kodu: <b>{me.recoveryCodesLeft}</b>. Kapatmak için şifreniz ve güncel kod gerekir.</p>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <input type="password" required placeholder="Şifre" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} className={input} />
            <input required placeholder="6 haneli kod" inputMode="numeric" value={code} onChange={(e) => setCode(e.target.value.replace(/[^\d ]/g, "").slice(0, 7))} className={input} />
          </div>
          <button className="rounded-lg bg-white px-4 py-2 text-sm font-semibold text-red-700 ring-1 ring-red-200 hover:bg-red-50">İki adımlı doğrulamayı kapat</button>
        </form>
      )}
      <Msg m={msg} />
    </section>
  );
}
