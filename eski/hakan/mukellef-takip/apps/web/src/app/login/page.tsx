"use client";

import { AuthShell } from "@/components/shell/AuthShell";
import { PasswordInput } from "@/components/PasswordInput";
import { RefreshCw } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { api, ApiError, setToken } from "@/lib/api";

type LoginResult = { accessToken: string; mustChangePassword?: boolean } | { mfaRequired: true; mfaToken: string };
/** Resimli güvenlik kodu: iki adımlı doğrulaması kapalı hesaplarda sunucu ister (CAPTCHA_REQUIRED) */
type Captcha = { id: string; svg: string };

const input = "mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 outline-none focus:border-brand-500 focus:ring-4 focus:ring-brand-100";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [mfaToken, setMfaToken] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [useRecovery, setUseRecovery] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [captcha, setCaptcha] = useState<Captcha | null>(null);
  const [captchaAnswer, setCaptchaAnswer] = useState("");

  async function loadCaptcha() {
    setCaptcha(await api<Captcha>("/auth/captcha"));
    setCaptchaAnswer("");
  }

  function finish(r: { accessToken: string; mustChangePassword?: boolean }) {
    setToken(r.accessToken);
    router.replace(r.mustChangePassword ? "/sifre-degistir" : "/");
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      if (!mfaToken) {
        const body = captcha ? { email, password, captchaId: captcha.id, captchaAnswer } : { email, password };
        const r = await api<LoginResult>("/auth/login", { method: "POST", body: JSON.stringify(body) });
        setCaptcha(null);
        if ("mfaRequired" in r) {
          setMfaToken(r.mfaToken);
          setPassword("");
        } else finish(r);
      } else {
        const r = await api<{ accessToken: string; mustChangePassword?: boolean }>("/auth/login/2fa", {
          method: "POST",
          body: JSON.stringify(useRecovery ? { mfaToken, recoveryCode: code } : { mfaToken, code }),
        });
        finish(r);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Giriş başarısız";
      const code = err instanceof ApiError ? err.code : undefined;
      // Ara adımın süresi dolduysa baştan başlat
      if (mfaToken && /süresi doldu/.test(msg)) {
        setMfaToken(null);
        setCode("");
      }
      // Güvenlik kodu tek kullanımlık: istendiğinde, yanlışsa ya da şifre hatalıysa yeni kod gösterilir
      if (!mfaToken && (code?.startsWith("CAPTCHA_") || captcha)) await loadCaptcha().catch(() => undefined);
      // İlk istemede kutunun kendisi yeterli açıklama; hata kutusu yalnız gerçek hatada
      setError(code === "CAPTCHA_REQUIRED" ? null : msg);
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthShell>
      <form onSubmit={onSubmit} className="space-y-4">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight text-slate-900">Tekrar hoş geldiniz</h1>
          <p className="text-sm text-slate-500">{mfaToken ? "İki adımlı doğrulama" : "Hesabınıza giriş yapın"}</p>
        </div>

        {!mfaToken ? (
          <>
            <label className="block">
              <span className="text-sm font-medium">E-posta</span>
              <input type="email" required autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} className={input} />
            </label>
            <label className="block">
              <span className="text-sm font-medium">Şifre</span>
              <PasswordInput required autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} className={input} />
            </label>
            <div className="-mt-2 text-right">
              <Link href="/sifremi-unuttum" className="text-xs font-semibold text-brand-700 hover:underline">
                Şifremi unuttum
              </Link>
            </div>
            {captcha && (
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                <span className="text-sm font-medium">Güvenlik kodu</span>
                <p className="text-xs text-slate-500">Resimdeki harf ve rakamları yazın. İki adımlı doğrulamayı açarsanız bu kod sorulmaz.</p>
                <div className="mt-2 flex items-center gap-2">
                  {/* SVG yalnız görüntü olarak gösterilir (img); sayfaya HTML olarak eklenmez */}
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={`data:image/svg+xml;charset=utf-8,${encodeURIComponent(captcha.svg)}`}
                    alt="Güvenlik kodu resmi"
                    width={160}
                    height={56}
                    className="h-14 w-40 rounded-lg border border-slate-200 bg-white"
                  />
                  <button
                    type="button"
                    onClick={() => loadCaptcha().catch(() => undefined)}
                    className="flex size-10 items-center justify-center rounded-lg text-slate-500 hover:bg-white hover:text-slate-800"
                    aria-label="Yeni güvenlik kodu"
                    title="Okunmuyor mu? Yeni kod"
                  >
                    <RefreshCw size={18} />
                  </button>
                </div>
                <input
                  required
                  autoFocus
                  autoComplete="off"
                  autoCapitalize="characters"
                  spellCheck={false}
                  maxLength={8}
                  aria-label="Güvenlik kodu"
                  value={captchaAnswer}
                  onChange={(e) => setCaptchaAnswer(e.target.value.toUpperCase())}
                  className={`${input} text-center text-lg tracking-[0.3em] uppercase`}
                />
              </div>
            )}
          </>
        ) : (
          <>
            <label className="block">
              <span className="text-sm font-medium">{useRecovery ? "Kurtarma kodu" : "Doğrulayıcı uygulamadaki 6 haneli kod"}</span>
              <input
                required
                autoFocus
                autoComplete="one-time-code"
                inputMode={useRecovery ? "text" : "numeric"}
                placeholder={useRecovery ? "abcd-efgh" : "123 456"}
                value={code}
                onChange={(e) => setCode(useRecovery ? e.target.value : e.target.value.replace(/[^\d ]/g, "").slice(0, 7))}
                className={`${input} text-center text-lg tracking-widest`}
              />
            </label>
            <button
              type="button"
              onClick={() => {
                setUseRecovery(!useRecovery);
                setCode("");
              }}
              className="text-xs font-semibold text-brand-700 hover:underline"
            >
              {useRecovery ? "Doğrulayıcı kodu kullan" : "Telefonuma erişemiyorum — kurtarma kodu kullan"}
            </button>
          </>
        )}

        {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
        <button disabled={loading} className="w-full rounded-lg bg-brand-600 py-2.5 font-semibold text-white hover:bg-brand-700 disabled:opacity-60">
          {loading ? "Kontrol ediliyor…" : mfaToken ? "Doğrula" : "Giriş yap"}
        </button>
        {mfaToken && (
          <button
            type="button"
            onClick={() => {
              setMfaToken(null);
              setCode("");
              setError(null);
            }}
            className="w-full text-xs text-slate-500 hover:underline"
          >
            Geri dön
          </button>
        )}
      </form>
    </AuthShell>
  );
}
