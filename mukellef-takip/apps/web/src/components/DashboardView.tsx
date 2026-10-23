"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  AlertOctagon,
  ArrowUpRight,
  BarChart3,
  Bell,
  Briefcase,
  CalendarClock,
  CheckCircle2,
  ChevronRight,
  Clock,
  Gauge,
  Inbox,
  ListChecks,
  Mail,
  Stethoscope,
  Users,
  type LucideIcon,
} from "lucide-react";
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

type Tone = "ok" | "warn" | "bad" | "neutral";
const TONE: Record<Tone, string> = {
  ok: "bg-emerald-50 text-emerald-700",
  warn: "bg-amber-50 text-amber-700",
  bad: "bg-rose-50 text-rose-700",
  neutral: "bg-slate-100 text-slate-600",
};

function Chip({ tone, children }: { tone: Tone; children: React.ReactNode }) {
  return <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${TONE[tone]}`}>{children}</span>;
}

/* Linear/Stripe tarzı kart: ince kenarlık, yumuşak gölge, başlıkta alt çizgi */
function Card({ title, icon: Icon, action, children, className = "" }: { title: string; icon?: LucideIcon; action?: React.ReactNode; children: React.ReactNode; className?: string }) {
  return (
    <section className={`rounded-xl border border-slate-200 bg-white shadow-sm ${className}`}>
      <div className="flex items-center justify-between gap-3 border-b border-slate-100 px-5 py-3.5">
        <h2 className="flex items-center gap-2 text-[13px] font-semibold text-slate-900">
          {Icon && <Icon size={16} strokeWidth={1.5} className="text-slate-400" />}
          {title}
        </h2>
        {action}
      </div>
      <div className="p-5">{children}</div>
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

  if (error) return <p className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p>;
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

  const c = data.companies;
  const kpis: { label: string; value: string; icon: LucideIcon; sub: string; chip: { tone: Tone; text: string }; href: string }[] = [
    {
      label: "Aktif mükellef",
      value: String(c.aktif),
      icon: Users,
      sub: `${c.sirket} şirket · ${c.sahis} şahıs`,
      chip: c.total > c.aktif ? { tone: "neutral", text: `${c.total - c.aktif} pasif` } : { tone: "ok", text: "tümü aktif" },
      href: "/firmalar",
    },
    {
      label: "Güncel çalışan (SGK)",
      value: data.sgk.ebildirge.currentEmployees.toLocaleString("tr-TR"),
      icon: Briefcase,
      sub: `${data.sgk.workplaces} işyeri`,
      chip:
        data.sgk.entriesThisYear > 0
          ? { tone: "ok", text: `bu yıl +${data.sgk.entriesThisYear}` }
          : data.sgk.exitsThisYear > 0
            ? { tone: "bad", text: `bu yıl −${data.sgk.exitsThisYear}` }
            : { tone: "neutral", text: "değişim yok" },
      href: "/sgk",
    },
    {
      label: "e-Tebligat (bu ay)",
      value: String(data.eTebligat.month),
      icon: Mail,
      sub: `bu yıl toplam ${data.eTebligat.year}`,
      chip: data.eTebligat.open > 0 ? { tone: "warn", text: `${data.eTebligat.open} incelenmedi` } : { tone: "ok", text: "güncel" },
      href: "/tebligat",
    },
    {
      label: "e-Rapor onayı",
      value: String(data.sgk.reportsPending),
      icon: Stethoscope,
      sub: "SGK'ya bildirim",
      chip: data.sgk.reportsPending > 0 ? { tone: "warn", text: `${data.sgk.reportsPending} bekliyor` } : { tone: "ok", text: "güncel" },
      href: "/sgk",
    },
  ];

  const gaugeR = 52;
  const gaugeC = 2 * Math.PI * gaugeR;
  const gaugeDash = ((pct ?? 0) / 100) * gaugeC;

  return (
    <div className="space-y-5">
      {/* Başlık */}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-sm text-slate-500">{now.toLocaleDateString("tr-TR", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}</p>
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900">
            {greeting(now)}
            {firstName ? `, ${firstName}` : ""}
          </h1>
        </div>
        {data.license && (
          <Link
            href="/odeme"
            className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-600 shadow-sm transition hover:border-slate-300"
          >
            Lisans <b className="font-semibold tabular-nums text-slate-900">{data.license.daysLeft} gün</b>
            <span className="h-3.5 w-px bg-slate-200" />
            <b className="font-semibold tabular-nums text-slate-900">
              {data.license.quotaUsed}/{data.license.quota}
            </b>{" "}
            mükellef
          </Link>
        )}
      </div>

      {/* KPI kartları */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {kpis.map((k) => (
          <Link
            key={k.label}
            href={k.href}
            className="group rounded-xl border border-slate-200 bg-white p-5 shadow-sm transition hover:border-slate-300 hover:shadow"
          >
            <div className="flex items-start justify-between gap-2">
              <span className="flex size-9 items-center justify-center rounded-lg bg-brand-50 text-brand-600">
                <k.icon size={18} strokeWidth={1.5} />
              </span>
              <Chip tone={k.chip.tone}>{k.chip.text}</Chip>
            </div>
            <p className="mt-4 text-[26px] leading-none font-semibold tracking-tight text-slate-900 tabular-nums">{k.value}</p>
            <p className="mt-1.5 text-sm text-slate-500">{k.label}</p>
            <p className="mt-0.5 text-xs text-slate-400">{k.sub}</p>
          </Link>
        ))}
      </div>

      {/* Yapılacaklar + Uyum göstergesi */}
      <div className="grid gap-5 lg:grid-cols-[minmax(0,1.7fr)_minmax(0,1fr)]">
        <Card
          title="Yapılacaklar"
          icon={ListChecks}
          action={tasks.length > 0 ? <Chip tone="neutral">{tasks.length} konu</Chip> : undefined}
        >
          {tasks.length === 0 ? (
            <p className="flex items-center gap-2 rounded-lg bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
              <CheckCircle2 size={18} strokeWidth={1.5} /> Süresi yaklaşan ya da geciken bir iş görünmüyor.
            </p>
          ) : (
            <ul className="-mx-2 space-y-0.5">
              {tasks.map((t) => (
                <li key={t.key}>
                  <Link href={t.href} className="group flex items-center gap-3 rounded-lg px-2 py-2.5 transition hover:bg-slate-100">
                    <span
                      className={`flex size-8 shrink-0 items-center justify-center rounded-lg ${t.severity === "high" ? "bg-rose-50 text-rose-600" : "bg-amber-50 text-amber-600"}`}
                    >
                      <t.icon size={16} strokeWidth={1.5} />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-medium text-slate-900">{t.title}</span>
                      <span className="block truncate text-xs text-slate-500">{t.detail}</span>
                    </span>
                    <ChevronRight size={16} strokeWidth={1.5} className="shrink-0 text-slate-300 transition group-hover:text-slate-500" />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card title="Beyanname uyumu" icon={Gauge} action={<span className="text-xs text-slate-400">{b.periodLabel}</span>}>
          <div className="flex flex-col items-center">
            <div className="relative size-36">
              <svg viewBox="0 0 120 120" className="size-full -rotate-90">
                <circle cx="60" cy="60" r={gaugeR} fill="none" strokeWidth="10" className="stroke-slate-200" />
                <circle
                  cx="60"
                  cy="60"
                  r={gaugeR}
                  fill="none"
                  strokeWidth="10"
                  strokeLinecap="round"
                  className="stroke-brand-500 transition-[stroke-dasharray] duration-700"
                  strokeDasharray={`${gaugeDash} ${gaugeC}`}
                />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-4xl leading-none font-semibold tracking-tight text-slate-900 tabular-nums">{pct === null ? "—" : `%${pct}`}</span>
                <span className="mt-1 text-xs text-slate-500">uyum</span>
              </div>
            </div>
            <dl className="mt-6 w-full space-y-2.5">
              {[
                { dot: "bg-emerald-500", label: "Verildi", value: b.filed },
                { dot: "bg-amber-500", label: "Bekliyor", value: b.pending },
                { dot: "bg-rose-500", label: "Gecikti", value: b.late },
              ].map((r) => (
                <div key={r.label} className="flex items-center justify-between text-sm">
                  <dt className="flex items-center gap-2 text-slate-600">
                    <span className={`size-2 rounded-full ${r.dot}`} /> {r.label}
                  </dt>
                  <dd className="font-medium tabular-nums text-slate-900">{r.value}</dd>
                </div>
              ))}
            </dl>
          </div>
        </Card>
      </div>

      {/* Beyanname durumu (segmentli) + sağ sütun */}
      <div className="grid gap-5 lg:grid-cols-[minmax(0,1.7fr)_minmax(0,1fr)]">
        <Card
          title={`Beyanname durumu · ${b.periodLabel}`}
          icon={BarChart3}
          action={
            <Link href="/beyanname" className="inline-flex items-center gap-1 text-xs font-medium text-brand-600 hover:text-brand-700">
              Kontrol ekranı <ArrowUpRight size={13} strokeWidth={1.5} />
            </Link>
          }
        >
          <div className="mb-4">
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

        <div className="space-y-5">
          <Card title="Bu hafta" icon={CalendarClock} action={<span className="text-xs text-slate-400">Vergi son günleri</span>}>
            <ol className="relative ml-1 space-y-4 border-l border-slate-200 pl-5">
              {agenda.map(({ date, events }) => {
                const n = daysUntil(date.toISOString(), now);
                const isToday = n === 0;
                return (
                  <li key={date.toDateString()} className={`relative ${n < 0 ? "opacity-50" : ""}`}>
                    <span
                      className={`absolute top-1 -left-[25px] size-2.5 rounded-full ring-4 ring-white ${isToday ? "bg-brand-500" : events.length ? "bg-amber-500" : "bg-slate-300"}`}
                    />
                    <p className="text-xs font-medium text-slate-500">
                      {date.toLocaleDateString("tr-TR", { weekday: "long", day: "numeric", month: "long" })}
                      {isToday && <span className="ml-2 rounded-full bg-brand-50 px-1.5 py-0.5 text-[10px] font-medium text-brand-700">bugün</span>}
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

          <Card
            title="Son bildirimler"
            icon={Bell}
            action={data.unreadCount > 0 ? <Chip tone="ok">{data.unreadCount} yeni</Chip> : undefined}
          >
            <ul className="-mx-2 space-y-0.5">
              {data.notifications.map((n) => {
                const inner = (
                  <>
                    <span className={`mt-1.5 size-1.5 shrink-0 rounded-full ${n.isRead ? "bg-transparent" : "bg-brand-500"}`} />
                    <span className="min-w-0">
                      <span className={`block text-sm ${n.isRead ? "text-slate-600" : "font-medium text-slate-900"}`}>{n.title}</span>
                      {n.body && <span className="block truncate text-xs text-slate-500">{n.body}</span>}
                      <span className="block text-[11px] text-slate-400">{new Date(n.createdAt).toLocaleString("tr-TR", { dateStyle: "short", timeStyle: "short" })}</span>
                    </span>
                  </>
                );
                return (
                  <li key={n.id}>
                    {n.link ? (
                      <Link href={n.link} className="flex gap-2.5 rounded-lg px-2 py-2 transition hover:bg-slate-100">
                        {inner}
                      </Link>
                    ) : (
                      <div className="flex gap-2.5 px-2 py-2">{inner}</div>
                    )}
                  </li>
                );
              })}
              {data.notifications.length === 0 && <li className="py-4 text-center text-sm text-slate-500">Bildirim yok</li>}
            </ul>
          </Card>
        </div>
      </div>
    </div>
  );
}
