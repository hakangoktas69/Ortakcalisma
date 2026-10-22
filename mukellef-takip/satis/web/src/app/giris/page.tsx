"use client";

import { ShieldCheck } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { AuthCard } from "@/components/AuthCard";
import { PasswordInput } from "@/components/PasswordInput";
import { btnPrimary, btnSecondary, ErrorBox, input, label } from "@/components/ui";
import { api, errorText } from "@/lib/api";

type Step =
  | { kind: "password" }
  | { kind: "mfa"; token: string }
  | { kind: "setup"; token: string; qr?: string; secret?: string }
  | { kind: "codes"; codes: string[]; mustChangePassword: boolean };

/**
 * Satış girişi. İki adımlı doğrulama zorunludur: ilk girişte kurulur (QR), sonraki girişlerde kod istenir.
 * Kurtarma kodları kurulumda bir kez gösterilir.
 */
export default function LoginPage() {
  const router = useRouter();
  const [step, setStep] = useState<Step>({ kind: "password" });
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [useRecovery, setUseRecovery] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const run = async (fn: () => Promise<void>) => {
    setBusy(true);
    setError(null);
    try {
      await fn();
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(false);
    }
  };

  const enter = (mustChangePassword: boolean) => router.replace(mustChangePassword ? "/sifre" : "/");

  const submitPassword = (e: React.FormEvent) => {
    e.preventDefault();
    run(async () => {
      const r = await api<{ step: "mfa" | "setup"; token: string }>("/auth/login", { body: { email, password } });
      setPassword("");
      if (r.step === "mfa") setStep({ kind: "mfa", token: r.token });
      else {
        const s = await api<{ qr: string; secret: string }>("/auth/2fa/setup", { body: { token: r.token } });
        setStep({ kind: "setup", token: r.token, ...s });
      }
    });
  };

  const submitCode = (e: React.FormEvent) => {
    e.preventDefault();
    if (step.kind !== "mfa") return;
    run(async () => {
      const body = useRecovery ? { token: step.token, recoveryCode: code.trim() } : { token: step.token, code: code.trim() };
      const r = await api<{ mustChangePassword: boolean }>("/auth/login/2fa", { body });
      enter(r.mustChangePassword);
    });
  };

  const submitSetup = (e: React.FormEvent) => {
    e.preventDefault();
    if (step.kind !== "setup") return;
    run(async () => {
      const r = await api<{ mustChangePassword: boolean; recoveryCodes: string[] }>("/auth/2fa/enable", { body: { token: step.token, code: code.trim() } });
      setStep({ kind: "codes", codes: r.recoveryCodes, mustChangePassword: r.mustChangePassword });
    });
  };

  if (step.kind === "codes") {
    return (
      <AuthCard title="Kurtarma kodlarınız" subtitle="Telefonunuzu kaybederseniz bu kodlarla giriş yapabilirsiniz. Her kod bir kez kullanılır.">
        <p className="mb-3 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-900">Bu kodlar bir daha gösterilmez. Şimdi güvenli bir yere kaydedin.</p>
        <div className="grid grid-cols-2 gap-2">
          {step.codes.map((c) => (
            <code key={c} className="rounded bg-slate-100 px-2 py-1 text-center font-mono text-sm">
              {c}
            </code>
          ))}
        </div>
        <button className={`${btnPrimary} mt-5 w-full`} onClick={() => enter(step.mustChangePassword)}>
          Kaydettim, devam et
        </button>
      </AuthCard>
    );
  }

  if (step.kind === "setup") {
    return (
      <AuthCard title="İki adımlı doğrulamayı kurun" subtitle="Satış portalında iki adımlı doğrulama zorunludur.">
        <ol className="mb-4 list-decimal space-y-1 pl-5 text-sm text-slate-700">
          <li>Telefonunuzda Google Authenticator ya da Microsoft Authenticator uygulamasını açın.</li>
          <li>Aşağıdaki karekodu okutun.</li>
          <li>Uygulamada görünen 6 haneli kodu yazın.</li>
        </ol>
        {step.qr && (
          // QR görseli API'den data: adresi olarak gelir; next/image gerekmez
          // eslint-disable-next-line @next/next/no-img-element
          <img src={step.qr} alt="İki adımlı doğrulama karekodu" width={220} height={220} className="mx-auto rounded-lg border border-slate-200" />
        )}
        {step.secret && (
          <p className="mt-3 text-center text-xs text-slate-500">
            Karekod okunmuyorsa elle girin: <span className="break-all font-mono text-slate-700">{step.secret}</span>
          </p>
        )}
        <form onSubmit={submitSetup} className="mt-4 space-y-3">
          <div>
            <label htmlFor="code" className={label}>
              6 haneli kod
            </label>
            <input id="code" className={input} inputMode="numeric" autoComplete="one-time-code" maxLength={6} value={code} onChange={(e) => setCode(e.target.value)} required />
          </div>
          <ErrorBox message={error} />
          <button className={`${btnPrimary} w-full`} disabled={busy}>
            <ShieldCheck size={16} /> Doğrula ve aç
          </button>
        </form>
      </AuthCard>
    );
  }

  if (step.kind === "mfa") {
    return (
      <AuthCard title="Doğrulama kodu" subtitle={useRecovery ? "Kurtarma kodlarınızdan birini yazın." : "Telefonunuzdaki doğrulayıcı uygulamada görünen kodu yazın."}>
        <form onSubmit={submitCode} className="space-y-3">
          <div>
            <label htmlFor="code" className={label}>
              {useRecovery ? "Kurtarma kodu" : "6 haneli kod"}
            </label>
            <input
              id="code"
              className={input}
              inputMode={useRecovery ? "text" : "numeric"}
              autoComplete="one-time-code"
              maxLength={useRecovery ? 20 : 6}
              value={code}
              onChange={(e) => setCode(e.target.value)}
              autoFocus
              required
            />
          </div>
          <ErrorBox message={error} />
          <button className={`${btnPrimary} w-full`} disabled={busy}>
            Giriş yap
          </button>
          <button
            type="button"
            className={`${btnSecondary} w-full`}
            onClick={() => {
              setUseRecovery(!useRecovery);
              setCode("");
              setError(null);
            }}
          >
            {useRecovery ? "Doğrulayıcı koduyla gir" : "Telefonum yanımda değil (kurtarma kodu)"}
          </button>
        </form>
      </AuthCard>
    );
  }

  return (
    <AuthCard title="Satış portalı" subtitle="Müşavir hesabı açmak ve yönetmek için giriş yapın.">
      <form onSubmit={submitPassword} className="space-y-3">
        <div>
          <label htmlFor="email" className={label}>
            E-posta
          </label>
          <input id="email" type="email" className={input} autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} required />
        </div>
        <div>
          <label htmlFor="password" className={label}>
            Şifre
          </label>
          <PasswordInput
            id="password"
            className={input}
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
        </div>
        <ErrorBox message={error} />
        <button className={`${btnPrimary} w-full`} disabled={busy}>
          Devam
        </button>
      </form>
    </AuthCard>
  );
}
