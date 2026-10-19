"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ShieldCheck } from "lucide-react";
import { AuthShell } from "@/components/shell/AuthShell";
import { TwoFactorSection } from "@/components/SecurityView";
import { api, getToken, setToken, type Me } from "@/lib/api";

/**
 * Büro yöneticisi iki adımlı doğrulamayı zorunlu yaptıysa, kurmamış kullanıcı buraya yönlendirilir.
 * API bu kullanıcıya kurulum dışındaki hiçbir uca izin vermez; kurulum bitince portala geçilir.
 */
export default function TwoFactorRequiredPage() {
  const router = useRouter();
  const [me, setMe] = useState<Me | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!getToken()) {
      router.replace("/login");
      return;
    }
    let alive = true;
    api<Me>("/auth/me")
      .then((m) => {
        if (!alive) return;
        // Zaten kurmuşsa ya da zorunluluk yoksa burada işi yok
        if (m.twoFactorEnabled || !m.twoFactorRequired) router.replace("/");
        else setMe(m);
      })
      .catch((e) => alive && setError(e.message));
    return () => {
      alive = false;
    };
  }, [router]);

  function logout() {
    setToken(null);
    router.replace("/login");
  }

  return (
    <AuthShell wide>
      <div className="space-y-5">
        <div>
          <span className="inline-flex size-10 items-center justify-center rounded-xl bg-brand-50 text-brand-600">
            <ShieldCheck size={22} />
          </span>
          <h1 className="mt-3 text-2xl font-extrabold tracking-tight text-slate-900">İki adımlı doğrulamayı kurun</h1>
          <p className="mt-1 text-sm text-slate-600">
            Büronuzun yöneticisi, mükellef verilerini korumak için iki adımlı doğrulamayı zorunlu yaptı. Kurulum yaklaşık bir dakika
            sürer; telefonunuzda Google Authenticator veya Microsoft Authenticator gibi bir doğrulayıcı uygulama olması yeterli.
          </p>
        </div>

        {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
        {!me && !error && <p className="text-sm text-slate-500">Yükleniyor…</p>}
        {me && <TwoFactorSection me={me} onChanged={() => {}} onDone={() => router.replace("/")} />}

        <button onClick={logout} className="text-sm text-slate-500 hover:underline">
          Şimdi değil, çıkış yap
        </button>
      </div>
    </AuthShell>
  );
}
