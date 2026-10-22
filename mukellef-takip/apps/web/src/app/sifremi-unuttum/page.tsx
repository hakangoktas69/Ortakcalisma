"use client";

import { AuthShell } from "@/components/shell/AuthShell";
import { PasswordInput } from "@/components/PasswordInput";
import Link from "next/link";
import { useState } from "react";
import { api } from "@/lib/api";

const input = "mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 outline-none focus:border-brand-500 focus:ring-4 focus:ring-brand-100";

interface RequestResult {
  sent: boolean;
  channel: "email" | "phone";
  to: string;
  ttlMinutes: number;
  /** Yalnız geliştirmede, kod gerçekten gönderilmediğinde (PASSWORD_RESET_MODE=mock) */
  devCode?: string;
}

/**
 * Şifremi unuttum: e-posta ya da cep telefonuna 6 haneli kod, ardından yeni şifre.
 * Kayıtlı olup olmadığı ekranda belli edilmez. İki adımlı doğrulama açıksa girişte yine istenir.
 */
export default function ForgotPasswordPage() {
  const [identifier, setIdentifier] = useState("");
  const [sent, setSent] = useState<RequestResult | null>(null);
  const [code, setCode] = useState("");
  const [next, setNext] = useState("");
  const [again, setAgain] = useState("");
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function run(fn: () => Promise<void>) {
    setError(null);
    setLoading(true);
    try {
      await fn();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Bir hata oluştu");
    } finally {
      setLoading(false);
    }
  }

  const requestCode = (e?: React.FormEvent) => {
    e?.preventDefault();
    run(async () => {
      const r = await api<RequestResult>("/auth/password-reset/request", { method: "POST", body: JSON.stringify({ identifier }) });
      setSent(r);
      setCode("");
    });
  };

  const confirm = (e: React.FormEvent) => {
    e.preventDefault();
    if (next !== again) return setError("Yeni şifreler aynı değil");
    run(async () => {
      await api("/auth/password-reset/confirm", { method: "POST", body: JSON.stringify({ identifier, code, newPassword: next }) });
      setDone(true);
    });
  };

  if (done) {
    return (
      <AuthShell>
        <div className="space-y-4">
          <h1 className="text-xl font-bold text-slate-900">Şifreniz değişti</h1>
          <p className="text-sm text-slate-600">
            Yeni şifrenizle giriş yapabilirsiniz. Diğer cihazlardaki oturumlarınız kapatıldı. İki adımlı doğrulama açıksa girişte telefonunuzdaki kod da istenir.
          </p>
          <Link href="/login" className="block w-full rounded-lg bg-brand-600 py-2.5 text-center font-semibold text-white hover:bg-brand-700">
            Girişe dön
          </Link>
        </div>
      </AuthShell>
    );
  }

  return (
    <AuthShell>
      {!sent ? (
        <form onSubmit={requestCode} className="space-y-4">
          <div>
            <h1 className="text-xl font-bold text-slate-900">Şifremi unuttum</h1>
            <p className="text-sm text-slate-500">Hesabınızdaki e-posta adresini ya da cep telefonu numarasını yazın; size 6 haneli bir kod gönderelim.</p>
          </div>
          <label className="block">
            <span className="text-sm font-medium">E-posta ya da cep telefonu</span>
            <input
              required
              autoFocus
              autoComplete="username"
              placeholder="ornek@buro.com ya da 0532 123 45 67"
              value={identifier}
              onChange={(e) => setIdentifier(e.target.value)}
              className={input}
            />
          </label>
          {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
          <button disabled={loading} className="w-full rounded-lg bg-brand-600 py-2.5 font-semibold text-white hover:bg-brand-700 disabled:opacity-60">
            {loading ? "Gönderiliyor…" : "Kod gönder"}
          </button>
          <Link href="/login" className="block text-center text-xs text-slate-500 hover:underline">
            Girişe dön
          </Link>
        </form>
      ) : (
        <form onSubmit={confirm} className="space-y-4">
          <div>
            <h1 className="text-xl font-bold text-slate-900">Kodu girin</h1>
            <p className="text-sm text-slate-500">
              Bu {sent.channel === "email" ? "e-posta adresi" : "numara"} kayıtlıysa <span className="font-medium text-slate-700">{sent.to}</span>{" "}
              {sent.channel === "email" ? "adresine" : "numarasına"} bir kod gönderdik. Kod {sent.ttlMinutes} dakika geçerli.
            </p>
          </div>
          {sent.devCode && (
            <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
              Deneme modu: kod gönderilmedi. Kodunuz <span className="font-mono font-bold tracking-widest">{sent.devCode}</span>
            </p>
          )}
          <label className="block">
            <span className="text-sm font-medium">6 haneli kod</span>
            <input
              required
              autoFocus
              autoComplete="one-time-code"
              inputMode="numeric"
              placeholder="123 456"
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/[^\d ]/g, "").slice(0, 7))}
              className={`${input} text-center text-lg tracking-widest`}
            />
          </label>
          <label className="block">
            <span className="text-sm font-medium">Yeni şifre</span>
            <PasswordInput required autoComplete="new-password" value={next} onChange={(e) => setNext(e.target.value)} className={input} />
            <span className="text-xs text-slate-500">En az 10 karakter; harf ve rakam içermeli.</span>
          </label>
          <label className="block">
            <span className="text-sm font-medium">Yeni şifre (tekrar)</span>
            <PasswordInput required autoComplete="new-password" value={again} onChange={(e) => setAgain(e.target.value)} className={input} />
          </label>
          {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
          <button disabled={loading} className="w-full rounded-lg bg-brand-600 py-2.5 font-semibold text-white hover:bg-brand-700 disabled:opacity-60">
            {loading ? "Kaydediliyor…" : "Şifreyi değiştir"}
          </button>
          <div className="flex justify-between text-xs">
            <button type="button" onClick={() => requestCode()} disabled={loading} className="font-semibold text-brand-700 hover:underline">
              Kodu tekrar gönder
            </button>
            <button
              type="button"
              onClick={() => {
                setSent(null);
                setError(null);
              }}
              className="text-slate-500 hover:underline"
            >
              Başka adres yaz
            </button>
          </div>
        </form>
      )}
    </AuthShell>
  );
}
