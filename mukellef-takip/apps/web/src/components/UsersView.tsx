"use client";

import { useCallback, useEffect, useState } from "react";
import { Copy, KeyRound, Lock, ShieldCheck, UserPlus, X } from "lucide-react";
import { api } from "@/lib/api";

interface UserRow {
  id: string;
  email: string;
  fullName: string;
  role: "ADMIN" | "STAFF";
  isActive: boolean;
  mustChangePassword: boolean;
  twoFactorEnabled: boolean;
  locked: boolean;
  lastLoginAt: string | null;
  isMe: boolean;
}

const roleLabel = { ADMIN: "Yönetici", STAFF: "Personel" } as const;

/** Geçici şifreyi bir kez gösteren kutu. */
function TempPassword({ who, password, onClose }: { who: string; password: string; onClose: () => void }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="space-y-2 rounded-lg border border-emerald-300 bg-emerald-50 p-4 text-sm">
      <div className="flex items-start justify-between gap-2">
        <p className="font-semibold text-emerald-900">{who} için geçici şifre — bir daha gösterilmeyecek</p>
        <button onClick={onClose} aria-label="Kapat" className="rounded p-1 text-emerald-800 hover:bg-emerald-100"><X size={16} /></button>
      </div>
      <div className="flex gap-2">
        <input readOnly value={password} onFocus={(e) => e.target.select()} className="min-w-0 flex-1 rounded-lg border border-emerald-300 bg-white px-2 py-1.5 font-mono" />
        <button
          onClick={() => navigator.clipboard.writeText(password).then(() => setCopied(true))}
          className="flex items-center gap-1 rounded-lg bg-brand-600 px-3 text-xs font-semibold text-white hover:bg-brand-700"
        >
          <Copy size={14} /> {copied ? "Kopyalandı" : "Kopyala"}
        </button>
      </div>
      <p className="text-xs text-emerald-900">Kullanıcıya güvenli bir yoldan iletin. İlk girişte kendi şifresini belirlemesi istenecek.</p>
    </div>
  );
}

interface Policy {
  require2fa: boolean;
  usersWithout2fa: number;
}

/** Büro güvenlik politikası: iki adımlı doğrulama zorunluluğu (sadece yönetici) */
function PolicyCard({ policy, onChange }: { policy: Policy; onChange: (p: Policy) => void }) {
  const [asking, setAsking] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save(require2fa: boolean) {
    setBusy(true);
    setError(null);
    try {
      onChange(await api<Policy>("/users/policy", { method: "PUT", body: JSON.stringify({ require2fa }) }));
      setAsking(false);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5">
      <div className="flex flex-wrap items-start gap-3">
        <ShieldCheck size={20} className={policy.require2fa ? "mt-0.5 text-emerald-600" : "mt-0.5 text-slate-400"} />
        <div className="min-w-0 flex-1">
          <h2 className="font-semibold">İki adımlı doğrulama zorunlu</h2>
          <p className="text-sm text-slate-600">
            Açıkken iki adımlı doğrulaması olmayan kullanıcı önce kurulum ekranına yönlendirilir. Kurmadan hiçbir sayfayı açamaz,
            eklenti anahtarı da çalışmaz. Kuran kullanıcı doğrulamayı kendi başına kapatamaz.
          </p>
          <p className="mt-1 text-xs text-slate-500">
            {policy.usersWithout2fa === 0 ? "Bütün aktif kullanıcılarda iki adımlı doğrulama açık." : `${policy.usersWithout2fa} aktif kullanıcı henüz kurmadı.`}
          </p>
        </div>
        <button
          role="switch"
          aria-checked={policy.require2fa}
          aria-label="İki adımlı doğrulama zorunlu"
          disabled={busy}
          onClick={() => (policy.require2fa ? save(false) : setAsking(true))}
          className={`relative h-6 w-11 shrink-0 rounded-full transition-colors disabled:opacity-60 ${policy.require2fa ? "bg-emerald-600" : "bg-slate-300"}`}
        >
          <span className={`absolute top-0.5 size-5 rounded-full bg-white shadow transition-all ${policy.require2fa ? "left-[22px]" : "left-0.5"}`} />
        </button>
      </div>
      {asking && (
        <div className="mt-4 flex flex-wrap items-center gap-2 rounded-lg bg-amber-50 px-4 py-3 text-sm text-amber-900">
          <span className="flex-1">
            {policy.usersWithout2fa > 0
              ? `${policy.usersWithout2fa} kullanıcı bir sonraki işleminde kurulum ekranına yönlenecek ve kurana kadar portalı kullanamayacak.`
              : "Bundan sonra eklenen kullanıcılar da ilk girişte kurulum yapacak."}
          </span>
          <button onClick={() => setAsking(false)} className="rounded-lg px-3 py-1.5 text-amber-900 hover:bg-amber-100">
            Vazgeç
          </button>
          <button onClick={() => save(true)} disabled={busy} className="rounded-lg bg-amber-600 px-3 py-1.5 font-semibold text-white hover:bg-amber-700 disabled:opacity-60">
            Zorunlu yap
          </button>
        </div>
      )}
      {error && <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
    </section>
  );
}

export default function UsersView() {
  const [users, setUsers] = useState<UserRow[]>([]);
  const [msg, setMsg] = useState<{ kind: "ok" | "err"; text: string } | null>(null);
  const [temp, setTemp] = useState<{ who: string; password: string } | null>(null);
  const [form, setForm] = useState({ email: "", fullName: "", role: "STAFF" as UserRow["role"] });
  const [adding, setAdding] = useState(false);
  const [policy, setPolicy] = useState<Policy | null>(null);

  const load = useCallback(
    (isAlive: () => boolean = () => true) =>
      Promise.all([api<UserRow[]>("/users"), api<Policy>("/users/policy")]).then(([u, p]) => {
        if (!isAlive()) return;
        setUsers(u);
        setPolicy(p);
      }),
    [],
  );

  useEffect(() => {
    let alive = true;
    load(() => alive).catch((e) => alive && setMsg({ kind: "err", text: e.message }));
    return () => {
      alive = false;
    };
  }, [load]);

  async function run(fn: () => Promise<unknown>, ok?: string) {
    setMsg(null);
    try {
      await fn();
      if (ok) setMsg({ kind: "ok", text: ok });
      await load();
    } catch (e) {
      setMsg({ kind: "err", text: (e as Error).message });
    }
  }

  async function create(e: React.FormEvent) {
    e.preventDefault();
    await run(async () => {
      const r = await api<{ tempPassword: string }>("/users", { method: "POST", body: JSON.stringify(form) });
      setTemp({ who: form.fullName, password: r.tempPassword });
      setForm({ email: "", fullName: "", role: "STAFF" });
      setAdding(false);
    });
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold">Kullanıcılar</h1>
          <p className="text-xs text-slate-500">Büro personeli ve yetkileri. Devre dışı bırakma ve şifre sıfırlama açık oturumları hemen kapatır.</p>
        </div>
        <button onClick={() => setAdding(!adding)} className="flex items-center gap-2 rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700">
          <UserPlus size={16} /> Kullanıcı ekle
        </button>
      </div>

      {policy && <PolicyCard policy={policy} onChange={setPolicy} />}

      {adding && (
        <form onSubmit={create} className="grid grid-cols-1 gap-3 rounded-xl border border-slate-200 bg-white p-4 sm:grid-cols-4">
          <input required placeholder="Ad Soyad" value={form.fullName} onChange={(e) => setForm({ ...form, fullName: e.target.value })} className="rounded-lg border border-slate-300 px-3 py-2 text-sm sm:col-span-1" />
          <input required type="email" placeholder="E-posta" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className="rounded-lg border border-slate-300 px-3 py-2 text-sm sm:col-span-2" />
          <select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value as UserRow["role"] })} className="rounded-lg border border-slate-300 px-3 py-2 text-sm">
            <option value="STAFF">Personel</option>
            <option value="ADMIN">Yönetici</option>
          </select>
          <button className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700 sm:col-span-4">Ekle ve geçici şifre üret</button>
        </form>
      )}

      {temp && <TempPassword who={temp.who} password={temp.password} onClose={() => setTemp(null)} />}
      {msg && <p className={`rounded-lg px-3 py-2 text-sm ${msg.kind === "ok" ? "bg-emerald-50 text-emerald-800" : "bg-red-50 text-red-700"}`}>{msg.text}</p>}

      <div className="table-scroll overflow-x-auto rounded-xl border border-slate-200 bg-white">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500">
            <tr>
              <th className="px-4 py-3">Kullanıcı</th>
              <th className="px-4 py-3">Rol</th>
              <th className="px-4 py-3">Durum</th>
              <th className="px-4 py-3">Son giriş</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {users.map((u) => (
              <tr key={u.id} className={u.isActive ? "" : "bg-slate-50 text-slate-500"}>
                <td className="px-4 py-2.5">
                  <p className="font-medium">{u.fullName} {u.isMe && <span className="text-xs text-slate-400">(siz)</span>}</p>
                  <p className="text-xs text-slate-500">{u.email}</p>
                </td>
                <td className="px-4 py-2.5">
                  <select
                    value={u.role}
                    disabled={!u.isActive}
                    onChange={(e) => run(() => api(`/users/${u.id}`, { method: "PATCH", body: JSON.stringify({ role: e.target.value }) }), `${u.fullName}: rol ${roleLabel[e.target.value as UserRow["role"]]} yapıldı.`)}
                    className="rounded-lg border border-slate-300 px-2 py-1 text-xs"
                  >
                    <option value="STAFF">Personel</option>
                    <option value="ADMIN">Yönetici</option>
                  </select>
                </td>
                <td className="space-y-0.5 px-4 py-2.5 text-xs">
                  <p>{u.isActive ? "Aktif" : "Devre dışı"}</p>
                  {u.twoFactorEnabled && <p className="flex items-center gap-1 text-emerald-700"><ShieldCheck size={12} /> 2FA açık</p>}
                  {!u.twoFactorEnabled && u.isActive && policy?.require2fa && <p className="text-amber-700">2FA kurulumu bekliyor</p>}
                  {u.mustChangePassword && <p className="text-amber-700">Geçici şifre bekliyor</p>}
                  {u.locked && <p className="flex items-center gap-1 text-red-700"><Lock size={12} /> Kilitli (hatalı deneme)</p>}
                </td>
                <td className="px-4 py-2.5 text-xs">{u.lastLoginAt ? new Date(u.lastLoginAt).toLocaleString("tr-TR") : "—"}</td>
                <td className="px-4 py-2.5">
                  <div className="flex flex-wrap justify-end gap-1">
                    <button
                      onClick={() =>
                        confirm(`${u.fullName} için yeni geçici şifre üretilsin mi? Açık oturumları kapanır.`) &&
                        run(async () => {
                          const r = await api<{ tempPassword: string }>(`/users/${u.id}/reset-password`, { method: "POST" });
                          setTemp({ who: u.fullName, password: r.tempPassword });
                        })
                      }
                      className="flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-100"
                    >
                      <KeyRound size={13} /> Şifre sıfırla
                    </button>
                    {u.twoFactorEnabled && !u.isMe && (
                      <button
                        onClick={() => confirm(`${u.fullName} için iki adımlı doğrulama sıfırlansın mı? (Telefonunu kaybettiyse)`) && run(() => api(`/users/${u.id}/reset-2fa`, { method: "POST" }), "2FA sıfırlandı; kullanıcı yeniden kurabilir.")}
                        className="rounded-lg px-2 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-100"
                      >
                        2FA sıfırla
                      </button>
                    )}
                    {!u.isMe && (
                      <button
                        onClick={() =>
                          (u.isActive ? confirm(`${u.fullName} devre dışı bırakılsın mı? Hemen oturumu kapanır.`) : true) &&
                          run(() => api(`/users/${u.id}`, { method: "PATCH", body: JSON.stringify({ isActive: !u.isActive }) }), u.isActive ? `${u.fullName} devre dışı bırakıldı.` : `${u.fullName} yeniden etkinleştirildi.`)
                        }
                        className={`rounded-lg px-2 py-1 text-xs font-semibold ${u.isActive ? "text-red-700 hover:bg-red-50" : "text-emerald-700 hover:bg-emerald-50"}`}
                      >
                        {u.isActive ? "Devre dışı bırak" : "Etkinleştir"}
                      </button>
                    )}
                    {u.isActive && u.locked && (
                      <button
                        onClick={() => run(() => api(`/users/${u.id}`, { method: "PATCH", body: JSON.stringify({ isActive: true }) }), `${u.fullName} kilidi açıldı.`)}
                        className="flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-semibold text-emerald-700 hover:bg-emerald-50"
                      >
                        <Lock size={13} /> Kilidi aç
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
