"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { AlertOctagon, ArrowUpRight, CalendarClock, CheckCircle2, ChevronRight, Clock, Inbox, Stethoscope, type LucideIcon } from "lucide-react";
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

function Card({ title, action, children }: { title: string; action?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="mb-4 flex items-center justify-between gap-3">
        <h2 className="text-[15px] font-bold text-slate-900">{title}</h2>
        {action}
      </div>
      {children}
    </section>
  );
}

function Metric({ label, value, sub, href, progress }: { label: string; value: string; sub?: string; href: string; progress?: number }) {
  return (
    <Link href={href} className="group rounded-2xl border border-slate-200 bg-white p-4 shadow-sm transition hover:border-brand-300">
      <p className="flex items-center justify-between gap-2 text-xs font-medium text-slate-500">
        <span className="truncate">{label}</span>
        <ArrowUpRight size={14} className="shrink-0 text-slate-300 transition group-hover:text-brand-500" />
      </p>
      <p className="mt-1 text-2xl font-extrabold tracking-tight text-slate-900 tabular-nums">{value}</p>
      {progress !== undefined && (
        <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-100">
          <div className="h-full rounded-full bg-brand-500" style={{ width: `${Math.round(progress * 100)}%` }} />
        </div>
      )}
      {sub && <p className="mt-1.5 text-xs text-slate-500">{sub}</p>}
    </Link>
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

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-sm text-slate-500">{now.toLocaleDateString("tr-TR", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}</p>
          <h1 className="text-2xl font-extrabold tracking-tight text-slate-900">
            {greeting(now)}
            {firstName ? `, ${firstName}` : ""}
          </h1>
          <p className="mt-0.5 text-sm text-slate-600">{tasks.length ? `İlgilenmeniz gereken ${tasks.length} konu var.` : "Bekleyen acil bir iş yok."}</p>
        </div>
        {data.license && (
          <Link href="/odeme" className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs text-slate-600 shadow-sm hover:border-brand-300">
            Lisans <b className="text-slate-900">{data.license.daysLeft} gün</b> · Mükellef{" "}
            <b className="text-slate-900">
              {data.license.quotaUsed}/{data.license.quota}
            </b>
          </Link>
        )}
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
        <Card title="Yapılacaklar">
          {tasks.length === 0 ? (
            <p className="flex items-center gap-2 rounded-xl bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
              <CheckCircle2 size={18} /> Süresi yaklaşan ya da geciken bir iş görünmüyor.
            </p>
          ) : (
            <ul className="divide-y divide-slate-100">
              {tasks.map((t) => (
                <li key={t.key}>
                  <Link href={t.href} className="group -mx-2 flex items-center gap-3 rounded-xl px-2 py-3 hover:bg-slate-50">
                    <span
                      className={`flex size-9 shrink-0 items-center justify-center rounded-xl ${t.severity === "high" ? "bg-red-50 text-red-600" : "bg-amber-50 text-amber-600"}`}
                    >
                      <t.icon size={18} />
                    </span>
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
        </Card>

        <Card title="Bu hafta" action={<span className="text-xs text-slate-500">Vergi son günleri</span>}>
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
        </Card>
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Metric
          label="Aktif mükellef"
          value={String(data.companies.aktif)}
          sub={`${data.companies.total} kayıtlı · ${data.companies.sirket} şirket, ${data.companies.sahis} şahıs`}
          href="/firmalar"
        />
        <Metric
          label={`${b.periodLabel} beyannameleri`}
          value={expected ? `%${Math.round((b.filed / expected) * 100)}` : "—"}
          sub={`${b.filed} verildi · ${b.pending} bekliyor${b.late ? ` · ${b.late} gecikti` : ""}`}
          progress={expected ? b.filed / expected : 0}
          href="/beyanname"
        />
        <Metric
          label="Güncel çalışan (SGK)"
          value={data.sgk.ebildirge.currentEmployees.toLocaleString("tr-TR")}
          sub={`${data.sgk.workplaces} işyeri · bu yıl ${data.sgk.entriesThisYear} giriş, ${data.sgk.exitsThisYear} çıkış`}
          href="/sgk"
        />
        <Metric label="e-Tebligat (bu ay)" value={String(data.eTebligat.month)} sub={`bu yıl toplam ${data.eTebligat.year}`} href="/tebligat" />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
        <Card
          title={`Beyanname durumu · ${b.periodLabel}`}
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
        </Card>

        <Card
          title="Son bildirimler"
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
        </Card>
      </div>
    </div>
  );
}
