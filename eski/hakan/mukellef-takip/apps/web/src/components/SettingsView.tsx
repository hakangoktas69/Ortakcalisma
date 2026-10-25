"use client";

import { useEffect, useState } from "react";
import { api, notificationCategoryLabel, type NotificationCategory, type NotificationSettings } from "@/lib/api";

const CATEGORIES = Object.keys(notificationCategoryLabel) as NotificationCategory[];

function displayPhone(p: string | null) {
  if (!p) return "";
  const d = p.replace(/^90/, "0");
  return d.replace(/^(\d{4})(\d{3})(\d{2})(\d{2})$/, "$1 $2 $3 $4");
}

export default function SettingsView() {
  const [s, setS] = useState<NotificationSettings | null>(null);
  const [phone, setPhone] = useState("");
  const [enabled, setEnabled] = useState(false);
  const [consent, setConsent] = useState(false);
  const [categories, setCategories] = useState<NotificationCategory[]>([]);
  const [msg, setMsg] = useState<{ kind: "ok" | "err"; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  const apply = (r: NotificationSettings) => {
    setS(r);
    setPhone(displayPhone(r.phone));
    setEnabled(r.whatsappEnabled);
    setCategories(r.notifyCategories);
    setConsent(false);
  };

  useEffect(() => {
    let alive = true;
    api<NotificationSettings>("/me/notification-settings")
      .then((r) => {
        if (!alive) return;
        setS(r);
        setPhone(displayPhone(r.phone));
        setEnabled(r.whatsappEnabled);
        setCategories(r.notifyCategories);
      })
      .catch((e) => alive && setMsg({ kind: "err", text: e.message }));
    return () => {
      alive = false;
    };
  }, []);

  if (!s) return <p className="text-slate-500">Yükleniyor…</p>;

  const phoneChanged = phone.replace(/\D/g, "").replace(/^0/, "") !== (s.phone ?? "").replace(/^90/, "");
  const needsConsent = enabled && (!s.whatsappOptInAt || phoneChanged);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMsg(null);
    try {
      const r = await api<NotificationSettings>("/me/notification-settings", {
        method: "PUT",
        body: JSON.stringify({ phone, whatsappEnabled: enabled, consent, categories }),
      });
      apply(r);
      setMsg({ kind: "ok", text: "Bildirim ayarları kaydedildi." });
    } catch (err) {
      setMsg({ kind: "err", text: (err as Error).message });
    } finally {
      setBusy(false);
    }
  }

  async function test() {
    setBusy(true);
    setMsg(null);
    try {
      const r = await api<{ mode: string }>("/me/notification-settings/test", { method: "POST" });
      setMsg({ kind: "ok", text: r.mode === "mock" ? "Demo modunda deneme mesajı kaydedildi (gerçek mesaj gönderilmedi)." : "Deneme mesajı gönderildi." });
    } catch (err) {
      setMsg({ kind: "err", text: (err as Error).message });
    } finally {
      setBusy(false);
    }
  }

  const channelNote =
    s.channel.mode === "off"
      ? "WhatsApp kanalı bu kurulumda kapalı. Ayarlarınız kaydedilir, kanal açıldığında geçerli olur."
      : s.channel.mode === "mock"
        ? "Demo modu: mesajlar gönderilmiş gibi kaydedilir, telefonunuza gerçek mesaj gitmez."
        : !s.channel.configured
          ? "Canlı mod seçili ama Meta ayarları eksik; mesajlar gönderilemez."
          : "WhatsApp Business (Meta) üzerinden gerçek mesaj gönderilir.";

  return (
    <div className="max-w-2xl space-y-4">
      <h1 className="text-xl font-bold">Bildirim ayarları</h1>

      <form onSubmit={save} className="space-y-5 rounded-2xl border border-slate-200 bg-white p-5">
        <section className="space-y-2">
          <h2 className="font-semibold">Hangi bildirimleri almak istersiniz?</h2>
          <p className="text-xs text-slate-500">Uygulama içinde hepsi görünür; bu seçim WhatsApp&apos;a hangilerinin gideceğini belirler.</p>
          {CATEGORIES.map((c) => (
            <label key={c} className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={categories.includes(c)}
                onChange={(e) => setCategories(e.target.checked ? [...categories, c] : categories.filter((x) => x !== c))}
              />
              {notificationCategoryLabel[c]}
            </label>
          ))}
        </section>

        <section className="space-y-3 border-t border-slate-100 pt-4">
          <h2 className="font-semibold">WhatsApp</h2>
          <p className="rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-600">{channelNote}</p>
          <label className="block text-sm">
            <span className="font-medium">Cep telefonu</span>
            <input
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="0532 123 45 67"
              inputMode="tel"
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2"
            />
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={enabled} onChange={(e) => setEnabled(e.target.checked)} />
            Bildirimleri WhatsApp ile de gönder
          </label>
          {needsConsent && (
            <label className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
              <input type="checkbox" className="mt-0.5" checked={consent} onChange={(e) => setConsent(e.target.checked)} />
              <span>
                Bu numaraya WhatsApp üzerinden iş bildirimleri (tebligat, beyanname, SGK hatırlatmaları) gönderilmesini kabul
                ediyorum. İstediğim zaman bu ayardan kapatabilirim.
              </span>
            </label>
          )}
          {s.whatsappOptInAt && !phoneChanged && (
            <p className="text-xs text-slate-500">Onay tarihi: {new Date(s.whatsappOptInAt).toLocaleString("tr-TR")}</p>
          )}
        </section>

        {msg && (
          <p className={`rounded-lg px-3 py-2 text-sm ${msg.kind === "ok" ? "bg-emerald-50 text-emerald-800" : "bg-red-50 text-red-700"}`}>
            {msg.text}
          </p>
        )}

        <div className="flex flex-wrap gap-2">
          <button disabled={busy} className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-60">
            Kaydet
          </button>
          <button
            type="button"
            onClick={test}
            disabled={busy || !s.whatsappEnabled}
            className="rounded-lg bg-slate-100 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-200 disabled:opacity-50"
            title={s.whatsappEnabled ? "Kendi numaranıza deneme mesajı" : "Önce WhatsApp'ı açıp kaydedin"}
          >
            Deneme mesajı gönder
          </button>
        </div>
      </form>
    </div>
  );
}
