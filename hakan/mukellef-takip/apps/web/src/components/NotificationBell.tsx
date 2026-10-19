"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Bell, CheckCheck } from "lucide-react";
import { api, type NotificationList } from "@/lib/api";

const POLL_MS = 60_000;

function timeAgo(iso: string) {
  const s = Math.max(1, Math.round((Date.now() - new Date(iso).getTime()) / 1000));
  if (s < 3600) return `${Math.max(1, Math.round(s / 60))} dk önce`;
  if (s < 86_400) return `${Math.round(s / 3600)} sa önce`;
  return `${Math.round(s / 86_400)} gün önce`;
}

export default function NotificationBell() {
  const [data, setData] = useState<NotificationList | null>(null);
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const load = useCallback(
    (isAlive: () => boolean = () => true) =>
      api<NotificationList>("/notifications").then((d) => {
        if (isAlive()) setData(d);
      }),
    [],
  );

  useEffect(() => {
    let alive = true;
    const tick = () => load(() => alive).catch(() => {});
    tick();
    const t = setInterval(tick, POLL_MS);
    return () => {
      alive = false;
      clearInterval(t);
    };
  }, [load]);

  // Dışarı tıklayınca kapat
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  async function markRead(id: string) {
    await api(`/notifications/${id}/read`, { method: "POST" }).catch(() => {});
    load();
  }

  async function markAll() {
    await api("/notifications/read-all", { method: "POST" }).catch(() => {});
    load();
  }

  const unread = data?.unread ?? 0;

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((o) => !o)}
        className="relative rounded-full border border-slate-200 p-2 text-slate-600 hover:bg-slate-50"
        aria-label={`Bildirimler${unread ? ` (${unread} okunmamış)` : ""}`}
        aria-expanded={open}
      >
        <Bell size={18} />
        {unread > 0 && (
          <span className="absolute -right-1 -top-1 min-w-5 rounded-full bg-red-500 px-1 text-center text-[11px] font-bold leading-5 text-white">
            {unread > 99 ? "99+" : unread}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-12 z-40 w-[min(22rem,calc(100vw-2rem))] rounded-xl border border-slate-200 bg-white shadow-xl">
          <div className="flex items-center justify-between border-b border-slate-100 px-4 py-2.5">
            <p className="font-semibold">Bildirimler</p>
            {unread > 0 && (
              <button onClick={markAll} className="flex items-center gap-1 text-xs font-semibold text-brand-700 hover:underline">
                <CheckCheck size={14} /> Tümünü okundu yap
              </button>
            )}
          </div>
          <ul className="max-h-96 divide-y divide-slate-100 overflow-y-auto">
            {data?.items.map((n) => {
              const content = (
                <div className="flex gap-2">
                  <span className={`mt-1.5 size-2 shrink-0 rounded-full ${n.isRead ? "bg-transparent" : "bg-emerald-500"}`} aria-hidden />
                  <div className="min-w-0">
                    <p className={`text-sm ${n.isRead ? "text-slate-600" : "font-semibold text-slate-900"}`}>{n.title}</p>
                    {n.body && <p className="line-clamp-2 text-xs text-slate-500">{n.body}</p>}
                    <p className="mt-0.5 text-[11px] text-slate-400">{timeAgo(n.createdAt)}</p>
                  </div>
                </div>
              );
              return (
                <li key={n.id} className="hover:bg-slate-50">
                  {n.link ? (
                    <Link
                      href={n.link}
                      className="block px-4 py-2.5"
                      onClick={() => {
                        setOpen(false);
                        if (!n.isRead) markRead(n.id);
                      }}
                    >
                      {content}
                    </Link>
                  ) : (
                    <button className="block w-full px-4 py-2.5 text-left" onClick={() => !n.isRead && markRead(n.id)}>
                      {content}
                    </button>
                  )}
                </li>
              );
            })}
            {data && data.items.length === 0 && <li className="px-4 py-6 text-center text-sm text-slate-500">Bildirim yok</li>}
          </ul>
          <div className="border-t border-slate-100 px-4 py-2 text-right">
            <Link href="/ayarlar" onClick={() => setOpen(false)} className="text-xs font-semibold text-slate-600 hover:underline">
              Bildirim ayarları →
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
