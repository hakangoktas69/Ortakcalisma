"use client";

import { AuthShell } from "@/components/shell/AuthShell";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { api, setToken } from "@/lib/api";

const input = "mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 outline-none focus:border-brand-500 focus:ring-4 focus:ring-brand-100";

/** Yöneticinin verdiği geçici şifreyle giren kullanıcı burada kendi şifresini belirler. */
export default function ChangePasswordPage() {
  const router = useRouter();
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [again, setAgain] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (next !== again) return setError("Yeni şifreler aynı değil");
    setLoading(true);
    try {
      const r = await api<{ accessToken: string }>("/auth/password", {
        method: "POST",
        body: JSON.stringify({ currentPassword: current, newPassword: next }),
      });
      setToken(r.accessToken);
      router.replace("/");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Şifre değiştirilemedi");
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthShell>
      <form onSubmit={onSubmit} className="space-y-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Şifrenizi belirleyin</h1>
          <p className="text-sm text-slate-500">Size verilen geçici şifreyi kendi şifrenizle değiştirin.</p>
        </div>
        <label className="block">
          <span className="text-sm font-medium">Geçici (mevcut) şifre</span>
          <input type="password" required autoComplete="current-password" value={current} onChange={(e) => setCurrent(e.target.value)} className={input} />
        </label>
        <label className="block">
          <span className="text-sm font-medium">Yeni şifre</span>
          <input type="password" required autoComplete="new-password" value={next} onChange={(e) => setNext(e.target.value)} className={input} />
          <span className="text-xs text-slate-500">En az 10 karakter; harf ve rakam içermeli.</span>
        </label>
        <label className="block">
          <span className="text-sm font-medium">Yeni şifre (tekrar)</span>
          <input type="password" required autoComplete="new-password" value={again} onChange={(e) => setAgain(e.target.value)} className={input} />
        </label>
        {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
        <button disabled={loading} className="w-full rounded-lg bg-brand-600 py-2.5 font-semibold text-white hover:bg-brand-700 disabled:opacity-60">
          {loading ? "Kaydediliyor…" : "Şifreyi kaydet"}
        </button>
      </form>
    </AuthShell>
  );
}
