"use client";

import { useCallback, useEffect, useState } from "react";
import { Copy, KeyRound, Trash2, X } from "lucide-react";
import { api } from "@/lib/api";

interface Token {
  id: string;
  name: string;
  prefix: string;
  lastUsedAt: string | null;
  createdAt: string;
}

export default function ExtensionModal({ onClose }: { onClose: () => void }) {
  const [tokens, setTokens] = useState<Token[]>([]);
  const [name, setName] = useState("Chrome eklentisi");
  const [created, setCreated] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(
    (isAlive: () => boolean = () => true) =>
      api<Token[]>("/tokens").then((t) => {
        if (isAlive()) setTokens(t);
      }),
    [],
  );

  useEffect(() => {
    let alive = true;
    load(() => alive).catch((e) => alive && setError(e.message));
    return () => {
      alive = false;
    };
  }, [load]);

  async function create(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      const t = await api<{ token: string }>("/tokens", { method: "POST", body: JSON.stringify({ name }) });
      setCreated(t.token);
      setCopied(false);
      await load();
    } catch (err) {
      setError((err as Error).message);
    }
  }

  async function revoke(t: Token) {
    if (!confirm(`"${t.name}" anahtarı iptal edilsin mi? Bu anahtarı kullanan eklenti aktarım yapamaz.`)) return;
    try {
      await api(`/tokens/${t.id}`, { method: "DELETE" });
      await load();
    } catch (err) {
      setError((err as Error).message);
    }
  }

  async function copy() {
    if (!created) return;
    try {
      await navigator.clipboard.writeText(created);
      setCopied(true);
    } catch {
      setError("Kopyalanamadı; anahtarı seçip elle kopyalayın.");
    }
  }

  return (
    <div className="fixed inset-0 z-30 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-white p-5 shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="font-bold">GİB&apos;den aktar (tarayıcı eklentisi)</h2>
          <button onClick={onClose} className="rounded p-1 text-slate-500 hover:bg-slate-100" aria-label="Kapat">
            <X size={18} />
          </button>
        </div>

        <div className="space-y-4 text-sm">
          <ol className="list-decimal space-y-1 pl-5 text-slate-700">
            <li>Aşağıdan bir eklenti anahtarı oluşturun ve kopyalayın.</li>
            <li>
              Chrome&apos;da <code className="rounded bg-slate-100 px-1">chrome://extensions</code> → Geliştirici modu →
              &quot;Paketlenmemiş öğe yükle&quot; ile proje içindeki <code className="rounded bg-slate-100 px-1">apps/extension</code>{" "}
              klasörünü seçin.
            </li>
            <li>Eklentinin ayarlarına API adresini ve anahtarı girin.</li>
            <li>
              GİB e-Beyanname / e-Tebligat ya da SGK e-Bildirge sayfasını <b>kendi bilgilerinizle</b> açıp listeyi görüntüleyin, eklentide
              &quot;Bu sayfayı oku&quot;ya basın. Önizlemeyi kontrol edip &quot;Aktar&quot;a basın.
            </li>
          </ol>
          <p className="rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-600">
            Eklenti GİB şifrenizi görmez, GİB&apos;e kendisi istek atmaz; sadece sizin açtığınız sayfadaki tabloyu, siz
            istediğinizde okur. Anahtar yalnızca beyanname ve tebligat aktarabilir; firmalarınızı, SGK bilgilerinizi göremez.
          </p>

          {created ? (
            <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3">
              <p className="mb-2 font-semibold text-emerald-800">Anahtar oluşturuldu. Şimdi kopyalayın; bir daha gösterilmeyecek.</p>
              <div className="flex gap-2">
                <input readOnly value={created} onFocus={(e) => e.target.select()} className="min-w-0 flex-1 rounded-lg border border-emerald-300 bg-white px-2 py-1.5 font-mono text-xs" />
                <button onClick={copy} className="flex items-center gap-1 rounded-lg bg-brand-600 px-3 text-xs font-semibold text-white hover:bg-brand-700">
                  <Copy size={14} /> {copied ? "Kopyalandı" : "Kopyala"}
                </button>
              </div>
            </div>
          ) : (
            <form onSubmit={create} className="flex gap-2">
              <input required value={name} onChange={(e) => setName(e.target.value)} className="min-w-0 flex-1 rounded-lg border border-slate-300 px-3 py-2" placeholder="Anahtar adı" />
              <button className="flex items-center gap-1 rounded-lg bg-violet-600 px-3 font-semibold text-white hover:bg-violet-700">
                <KeyRound size={16} /> Anahtar oluştur
              </button>
            </form>
          )}

          {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-red-700">{error}</p>}

          <div>
            <h3 className="mb-1 font-semibold">Etkin anahtarlar</h3>
            {tokens.length === 0 ? (
              <p className="text-xs text-slate-500">Henüz anahtar yok.</p>
            ) : (
              <ul className="divide-y divide-slate-100 rounded-lg border border-slate-200">
                {tokens.map((t) => (
                  <li key={t.id} className="flex items-center gap-2 px-3 py-2">
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium">{t.name}</p>
                      <p className="text-xs text-slate-500">
                        <span className="font-mono">{t.prefix}…</span> · son kullanım{" "}
                        {t.lastUsedAt ? new Date(t.lastUsedAt).toLocaleString("tr-TR") : "hiç"}
                      </p>
                    </div>
                    <button onClick={() => revoke(t)} className="rounded p-1.5 text-slate-500 hover:bg-red-50 hover:text-red-700" title="İptal et">
                      <Trash2 size={16} />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
