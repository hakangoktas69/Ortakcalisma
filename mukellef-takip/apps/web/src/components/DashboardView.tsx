"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { AlertOctagon, ArrowUpRight, BarChart3, Bell, CalendarClock, CheckCircle2, ChevronRight, Clock, Inbox, ListChecks, Stethoscope, type LucideIcon } from "lucide-react";
import { api, formatDate, type DashboardSummary, type Me } from "@/lib/api";
import { StatusBars, StatusLegend } from "./StatusBars";

type Severity = "high" | "medium";
interface Task {
  key: string;
  severity: Severity;
  icon: LucideIcon;
  title: string;
  detail: string;
  href: string;
}

const DAY = 86_400_000;
const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
const daysUntil = (iso: string, now: Date) => Math.round((startOfDay(new Date(iso)).getTime() - startOfDay(now).getTime()) / DAY);

function relativeDay(n: number) {
  if (n === 0) return "bugün";
  if (n === 1) return "yarın";
  if (n === -1) return "dün";
  return n > 0 ? `${n} gün kaldı` : `${-n} gün geçti`;
}

function greeting(now: Date) {
  const h = now.getHours();
  return h < 6 ? "İyi geceler" : h < 12 ? "Günaydın" : h < 18 ? "İyi günler" : "İyi akşamlar";
}

/** Sayılardan "yapılacaklar" listesi üretir: en acil olan üstte */
function buildTasks(d: DashboardSummary, now: Date): Task[] {
  const tasks: Task[] = [];
  if (d.eBeyanname.late > 0)
    tasks.push({
      key: "late",
      severity: "high",
      icon: AlertOctagon,
      title: `${d.eBeyanname.late} beyannamenin süresi geçti`,
      detail: `${d.eBeyanname.periodLabel} dönemi · kontrol ekranından mükellefleri görün`,
      href: "/beyanname",
    });
  for (const t of [...d.eBeyanname.types].filter((t) => t.counts.PENDING > 0).sort((a, b) => a.dueDate.localeCompare(b.dueDate)).slice(0, 3)) {
    const n = daysUntil(t.dueDate, now);
    tasks.push({
      key: `due-${t.type}`,
      severity: n <= 3 ? "high" : "medium",
      icon: Clock,
      title: `${t.short}: ${t.counts.PENDING} mükellef henüz vermedi`,
      detail: `Son gün ${formatDate(t.dueDate)} · ${relativeDay(n)}`,
      href: "/beyanname",
    });
  }
  if (d.eTebligat.open > 0)
    tasks.push({
      key: "tebligat",
      severity: d.eTebligat.today > 0 ? "high" : "medium",
      icon: Inbox,
      title: `${d.eTebligat.open} tebligat incelenmedi`,
      detail: d.eTebligat.today > 0 ? `Bugün ${d.eTebligat.today} yeni tebligat geldi` : "Okunmasa da 5. günün sonunda tebliğ edilmiş sayılır",
      href: "/tebligat",
    });
  if (d.sgk.reportsPending > 0)
    tasks.push({
      key: "rapor",
      severity: "medium",
      icon: Stethoscope,
      title: `${d.sgk.reportsPending} e-rapor onay bekliyor`,
      detail: "Çalışmadığına dair bildirim SGK'ya iletilmeli",
      href: "/sgk",
    });
  if (d.license && d.license.daysLeft <= 30)
    tasks.push({
      key: "license",
      severity: d.license.daysLeft <= 7 ? "high" : "medium",
      icon: CalendarClock,
      title: `Lisansın bitmesine ${d.license.daysLeft} gün kaldı`,
      detail: "Lisans ve ödeme sayfasından süreyi uzatabilirsiniz",
      href: "/odeme",
    });
  return tasks.sort((a, b) => (a.severity === b.severity ? 0 : a.severity === "high" ? -1 : 1));
}

/* Ortak yüzey: ince kenarlık + yumuşak zemin. Tek tip ağır gölgeli kart yerine sakin panel. */
function Panel({ title, icon: Icon, action, children, className = "" }: { title: string; icon?: LucideIcon; action?: React.ReactNode; children: React.ReactNode; className?: string }) {
  return (
    <section className={`rounded-2xl border border-slate-200 bg-white ${className}`}>
      <div className="flex items-center justify-between gap-3 px-5 pt-4 pb-3">
        <h2 className="flex items-center gap-2 text-sm font-bold text-slate-900">
          {Icon && (
            <span className="flex size-6 items-center justify-center rounded-lg bg-brand-50 text-brand-700">
              <Icon size={14} />
            </span>
          )}
          {title}
        </h2>
        {action}
      </div>
      <div className="px-5 pb-5">{children}</div>
    </section>
  );
}

export default function DashboardPage() {
  const [data, setData] = useState<DashboardSummary | null>(null);
  const [me, setMe] = useState<Me | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    api<DashboardSummary>("/dashboard/summary")
      .then((d) => alive && setData(d))
      .catch((e) => alive && setError(e.message));
    api<Me>("/auth/me")
      .then((m) => alive && setMe(m))
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, []);

  if (error) return <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>;
  if (!data) return <p className="text-slate-500">Yükleniyor…</p>;

  const now = new Date();
  const tasks = buildTasks(data, now);
  const b = data.eBeyanname;
  const expected = b.filed + b.pending + b.late;
  const pct = expected ? Math.round((b.filed / expected) * 100) : null;
  const firstName = me?.fullName.split(" ")[0];

  // Haftalık ajanda: sadece son günü olan günler ve bugün
  const byDay = new Map<string, { date: Date; events: DashboardSummary["week"]["events"] }>();
  for (let i = 0; i < 7; i++) {
    const date = new Date(data.week.start);
    date.setDate(date.getDate() + i);
    byDay.set(date.toDateString(), { date, events: [] });
  }
  for (const e of data.week.events) byDay.get(new Date(e.dueDate).toDateString())?.events.push(e);
  const agenda = [...byDay.values()].filter((d) => d.events.length || d.date.toDateString() === now.toDateString());

  const metrics = [
    {
      label: "Aktif mükellef",
      value: String(data.companies.aktif),
      sub: `${data.companies.total} kayıtlı · ${data.companies.sirket} şirket, ${data.companies.sahis} şahıs`,
      href: "/firmalar",
    },
    {
      label: "Güncel çalışan (SGK)",
      value: data.sgk.ebildirge.currentEmployees.toLocaleString("tr-TR"),
      sub: `${data.sgk.workplaces} işyeri · bu yıl ${data.sgk.entriesThisYear} giriş, ${data.sgk.exitsThisYear} çıkış`,
      href: "/sgk",
    },
    {
      label: "e-Tebligat (bu ay)",
      value: String(data.eTebligat.month),
      sub: `bu yıl toplam ${data.eTebligat.year}${data.eTebligat.open ? ` · ${data.eTebligat.open} incelenmedi` : ""}`,
      href: "/tebligat",
    },
    {
      label: "e-Rapor onayı",
      value: String(data.sgk.reportsPending),
      sub: data.sgk.reportsPending ? "SGK'ya bildirim bekliyor" : "bekleyen onay yok",
      href: "/sgk",
    },
  ];

  return (
    <div className="space-y-6">
      {/* HERO — defter başlığı: her iki temada koyu lacivert kalır (ink). Tek öne çıkan sayı: dönem uyumu. */}
      <section className="ink relative overflow-hidden rounded-2xl bg-ink-900 px-6 py-6 text-white sm:px-8 sm:py-7">
        {/* sağ üstte sönük marka ışıması — tek, sade vurgu */}
        <div className="pointer-events-none absolute -top-16 -right-10 size-56 rounded-full bg-brand-500/20 blur-3xl" aria-hidden />
        <div className="relative flex flex-wrap items-end justify-between gap-x-10 gap-y-6">
          <div className="min-w-0">
            <p className="text-xs text-slate-400">{now.toLocaleDateString("tr-TR", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}</p>
            <h1 className="mt-0.5 text-2xl font-bold tracking-tight text-white">
              {greeting(now)}
              {firstName ? `, ${firstName}` : ""}
            </h1>
            <p className="mt-1 text-sm text-slate-300">
              {tasks.length ? (
                <>
                  İlgilenmeniz gereken <b className="font-semibold text-white">{tasks.length}</b> konu var.
                </>
              ) : (
                "Bekleyen acil bir iş görünmüyor."
              )}
            </p>
            {data.license && (
              <Link
                href="/odeme"
                className="mt-4 inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-3 py-1.5 text-xs text-slate-300 hover:bg-white/10"
              >
                Lisans <b className="font-semibold text-white">{data.license.daysLeft} gün</b>
                <span className="h-3 w-px bg-white/20" />
                Mükellef{" "}
                <b className="font-semibold text-white">
                  {data.license.quotaUsed}/{data.license.quota}
                </b>
              </Link>
            )}
          </div>

          {/* Öne çıkan sayı: dönem beyanname uyumu */}
          <Link href="/beyanname" className="group min-w-[15rem] flex-1 sm:max-w-sm">
            <p className="text-xs text-slate-400">{b.periodLabel} beyanname uyumu</p>
            <div className="mt-1 flex items-baseline gap-2">
              <span className="text-5xl font-black tracking-tight tabular-nums text-white">{pct === null ? "—" : `%${pct}`}</span>
              <ArrowUpRight size={18} className="mb-1 text-slate-500 transition group-hover:text-white" />
            </div>
            <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-white/10">
              <div className="h-full rounded-full bg-brand-400 transition-[width] duration-500" style={{ width: `${pct ?? 0}%` }} />
            </div>
            <div className="mt-3 flex flex-wrap gap-x-5 gap-y-1 text-xs">
              <span className="text-slate-300">
                <b className="font-semibold text-white tabular-nums">{b.filed}</b> verildi
              </span>
              <span className="text-slate-300">
                <b className="font-semibold text-white tabular-nums">{b.pending}</b> bekliyor
              </span>
              {b.late > 0 && (
                <span className="font-semibold text-amber-300 tabular-nums">{b.late} gecikti</span>
              )}
            </div>
          </Link>
        </div>
      </section>

      {/* Yapılacaklar + Bu hafta */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
        <Panel title="Yapılacaklar" icon={ListChecks}>
          {tasks.length === 0 ? (
            <p className="flex items-center gap-2 rounded-xl bg-brand-50 px-4 py-3 text-sm text-brand-800">
              <CheckCircle2 size={18} /> Süresi yaklaşan ya da geciken bir iş görünmüyor.
            </p>
          ) : (
            <ul className="space-y-1.5">
              {tasks.map((t) => (
                <li key={t.key}>
                  <Link
                    href={t.href}
                    className={`group flex items-center gap-3 rounded-xl border-l-[3px] py-2.5 pr-2 pl-3 transition hover:bg-slate-50 ${
                      t.severity === "high" ? "border-red-500" : "border-amber-400"
                    }`}
                  >
                    <t.icon size={18} className={`shrink-0 ${t.severity === "high" ? "text-red-500" : "text-amber-500"}`} />
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-semibold text-slate-900">{t.title}</span>
                      <span className="block truncate text-xs text-slate-500">{t.detail}</span>
                    </span>
                    <ChevronRight size={16} className="shrink-0 text-slate-300 group-hover:text-slate-500" />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Panel>

        <Panel title="Bu hafta" icon={CalendarClock} action={<span className="text-xs text-slate-500">Vergi son günleri</span>}>
          <ol className="relative ml-1 space-y-4 border-l border-slate-200 pl-5">
            {agenda.map(({ date, events }) => {
              const n = daysUntil(date.toISOString(), now);
              const isToday = n === 0;
              return (
                <li key={date.toDateString()} className={`relative ${n < 0 ? "opacity-50" : ""}`}>
                  <span
                    className={`absolute top-1 -left-[25px] size-2.5 rounded-full ring-4 ring-white ${isToday ? "bg-brand-600" : events.length ? "bg-amber-400" : "bg-slate-300"}`}
                  />
                  <p className="text-xs font-semibold text-slate-500">
                    {date.toLocaleDateString("tr-TR", { weekday: "long", day: "numeric", month: "long" })}
                    {isToday && <span className="ml-2 rounded-full bg-brand-50 px-1.5 py-0.5 text-[10px] text-brand-700">bugün</span>}
                  </p>
                  {events.length ? (
                    events.map((e) => (
                      <p key={e.id} className="mt-0.5 text-sm text-slate-800">
                        {e.title}
                      </p>
                    ))
                  ) : (
                    <p className="mt-0.5 text-sm text-slate-400">Son gün yok</p>
                  )}
                </li>
              );
            })}
          </ol>
        </Panel>
      </div>

      {/* Özet sayılar: tek defter şeridi (ayrı kartlar değil, iç çizgilerle bölünmüş) */}
      <div className="grid grid-cols-2 overflow-hidden rounded-2xl border border-slate-200 bg-white lg:grid-cols-4">
        {metrics.map((m, i) => (
          <Link
            key={m.label}
            href={m.href}
            className={`group p-5 transition hover:bg-slate-50 ${i > 0 ? "border-slate-200 lg:border-l" : ""} ${i >= 2 ? "border-t border-slate-200 lg:border-t-0" : ""} ${
              i === 1 ? "border-l border-slate-200 lg:border-l" : ""
            }`}
          >
            <p className="flex items-center justify-between gap-2 text-xs font-medium text-slate-500">
              <span className="truncate">{m.label}</span>
              <ArrowUpRight size={14} className="shrink-0 text-slate-300 transition group-hover:text-brand-500" />
            </p>
            <p className="mt-1.5 text-2xl font-extrabold tracking-tight text-slate-900 tabular-nums">{m.value}</p>
            <p className="mt-1 text-xs text-slate-500">{m.sub}</p>
          </Link>
        ))}
      </div>

      {/* Beyanname durumu + son bildirimler */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
        <Panel
          title={`Beyanname durumu · ${b.periodLabel}`}
          icon={BarChart3}
          action={
            <Link href="/beyanname" className="text-sm font-semibold text-brand-700 hover:underline">
              Kontrol ekranı
            </Link>
          }
        >
          <div className="mb-3">
            <StatusLegend />
          </div>
          <StatusBars
            rows={b.types.map((t) => ({
              key: t.type,
              label: t.short,
              sublabel: `son gün ${formatDate(t.dueDate)}`,
              counts: t.counts,
            }))}
          />
        </Panel>

        <Panel
          title="Son bildirimler"
          icon={Bell}
          action={data.unreadCount > 0 ? <span className="rounded-full bg-brand-600 px-2 py-0.5 text-xs font-bold text-white">{data.unreadCount} yeni</span> : undefined}
        >
          <ul className="space-y-1">
            {data.notifications.map((n) => {
              const inner = (
                <>
                  <span className={`mt-1.5 size-1.5 shrink-0 rounded-full ${n.isRead ? "bg-transparent" : "bg-brand-500"}`} />
                  <span className="min-w-0">
                    <span className={`block text-sm ${n.isRead ? "text-slate-600" : "font-semibold text-slate-900"}`}>{n.title}</span>
                    {n.body && <span className="block truncate text-xs text-slate-500">{n.body}</span>}
                    <span className="block text-[11px] text-slate-400">{new Date(n.createdAt).toLocaleString("tr-TR", { dateStyle: "short", timeStyle: "short" })}</span>
                  </span>
                </>
              );
              return (
                <li key={n.id}>
                  {n.link ? (
                    <Link href={n.link} className="-mx-2 flex gap-2.5 rounded-lg px-2 py-2 hover:bg-slate-50">
                      {inner}
                    </Link>
                  ) : (
                    <div className="-mx-2 flex gap-2.5 px-2 py-2">{inner}</div>
                  )}
                </li>
              );
            })}
            {data.notifications.length === 0 && <li className="py-4 text-center text-sm text-slate-500">Bildirim yok</li>}
          </ul>
        </Panel>
      </div>
    </div>
  );
}
