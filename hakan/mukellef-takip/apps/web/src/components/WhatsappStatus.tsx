"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { api } from "@/lib/api";

interface Channels {
  whatsapp: { mode: "off" | "mock" | "live"; configured: boolean; optedInUsers: number };
}

/** Üst bardaki "WhatsApp Açık/Kapalı" göstergesi; durum her zaman metinle de yazılır. */
export default function WhatsappStatus() {
  const [c, setC] = useState<Channels["whatsapp"] | null>(null);

  useEffect(() => {
    let alive = true;
    api<Channels>("/notifications/channels")
      .then((r) => alive && setC(r.whatsapp))
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, []);

  if (!c) return null;
  const on = c.mode !== "off" && c.configured;
  const label = c.mode === "off" ? "WhatsApp Kapalı" : !c.configured ? "WhatsApp Ayarsız" : c.mode === "mock" ? "WhatsApp Demo" : "WhatsApp Açık";
  const title =
    c.mode === "off"
      ? "WhatsApp bildirimleri kapalı"
      : !c.configured
        ? "Canlı mod seçili ama Meta ayarları eksik"
        : `${c.optedInUsers} kullanıcı WhatsApp bildirimi alıyor${c.mode === "mock" ? " (demo: gerçek mesaj gönderilmez)" : ""}`;

  return (
    <Link
      href="/ayarlar"
      title={title}
      className={`hidden items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold sm:flex ${
        on ? "bg-emerald-50 text-emerald-800 ring-1 ring-emerald-200" : "bg-slate-100 text-slate-600 ring-1 ring-slate-200"
      }`}
    >
      <span className={`size-2 rounded-full ${on ? "bg-emerald-500" : "bg-slate-400"}`} aria-hidden />
      {label}
    </Link>
  );
}
