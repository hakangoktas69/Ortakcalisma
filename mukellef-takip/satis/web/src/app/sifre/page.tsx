"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { AuthCard } from "@/components/AuthCard";
import { btnPrimary, btnSecondary, ErrorBox, input, label } from "@/components/ui";
import { api, errorText, type Me } from "@/lib/api";

/** Şifre değiştirme. Geçici şifreyle giren kullanıcı başka sayfa açmadan önce buraya gelir. */
export default function PasswordPage() {
  const router = useRouter();
  const [me, setMe] = useState<Me | null>(null);
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [repeat, setRepeat] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api<Me>("/auth/me").then(setMe, () => router.replace("/giris"));
  }, [router]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (next !== repeat) return setError("Yeni şifreler aynı değil");
    setBusy(true);
    setError(null);
    try {
      await api("/auth/password", { body: { current, next } });
      router.replace("/");
    } catch (err) {
      setError(errorText(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <AuthCard
      title={me?.mustChangePassword ? "Geçici şifrenizi değiştirin" : "Şifre değiştir"}
      subtitle="En az 10 karakter; harf ve rakam içermeli. Diğer cihazlardaki oturumlarınız kapanır."
    >
      <form onSubmit={submit} className="space-y-3">
        <div>
          <label htmlFor="current" className={label}>
            {me?.mustChangePassword ? "Geçici şifre" : "Mevcut şifre"}
          </label>
          <input id="current" type="password" className={input} autoComplete="current-password" value={current} onChange={(e) => setCurrent(e.target.value)} required />
        </div>
        <div>
          <label htmlFor="next" className={label}>
            Yeni şifre
          </label>
          <input id="next" type="password" className={input} autoComplete="new-password" value={next} onChange={(e) => setNext(e.target.value)} minLength={10} required />
        </div>
        <div>
          <label htmlFor="repeat" className={label}>
            Yeni şifre (tekrar)
          </label>
          <input id="repeat" type="password" className={input} autoComplete="new-password" value={repeat} onChange={(e) => setRepeat(e.target.value)} required />
        </div>
        <ErrorBox message={error} />
        <button className={`${btnPrimary} w-full`} disabled={busy}>
          Şifreyi değiştir
        </button>
        {me && !me.mustChangePassword && (
          <button type="button" className={`${btnSecondary} w-full`} onClick={() => router.back()}>
            Vazgeç
          </button>
        )}
      </form>
    </AuthCard>
  );
}
