"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  AlarmClock,
  ArrowLeft,
  ArrowUpRight,
  BookCheck,
  CheckCheck,
  CreditCard,
  FileText,
  Flame,
  Inbox,
  Mail,
  MoonStar,
  Search,
  Stethoscope,
  Timer,
  Wallet,
  type LucideIcon,
} from "lucide-react";
import { api, formatDate, type InboxItem, type InboxKind, type InboxResponse } from "@/lib/api";

type Folder = "all" | "late" | "soon" | "snoozed";

const KIND: Record<InboxKind, { label: string; icon: LucideIcon }> = {
  declaration: { label: "Beyanname", icon: FileText },
  tebligat: { label: "e-Tebligat", icon: Mail },
  report: { label: "e-Rapor", icon: Stethoscope },
  berat: { label: "e-Defter", icon: BookCheck },
  payroll: { label: "Bordro", icon: Wallet },
  license: { label: "Lisans", icon: CreditCard },
};
const KIND_ORDER: InboxKind[] = ["declaration", "tebligat", "report", "berat", "payroll", "license"];

const DAY = 86_400_000;
const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
const daysUntil = (iso: string, now: Date) => Math.round((startOfDay(new Date(iso)) - startOfDay(now)) / DAY);

/** Türkçe karakterleri sadeleştirip küçük harfe çevirir (arama için) */
const fold = (s: string) =>
  s
    .replace(/İ/g, "i")
    .replace(/I/g, "ı")
    .toLocaleLowerCase("tr")
    .replace(/[çğıöşü]/g, (c) => ({ ç: "c", ğ: "g", ı: "i", ö: "o", ş: "s", ü: "u" })[c]!);

function dueText(item: InboxItem, now: Date) {
  if (!item.dueDate) return new Date(item.date).toLocaleDateString("tr-TR", { day: "numeric", month: "short" });
  const n = daysUntil(item.dueDate, now);
  if (n < 0) return `${-n} gün gecikti`;
  if (n === 0) return "Bugün";
  if (n === 1) return "Yarın";
  return `${n} gün`;
}

function bucketOf(item: InboxItem, now: Date) {
  if (item.severity === "late") return "Gecikenler";
  if (!item.dueDate) return "Son günü olmayanlar";
  return daysUntil(item.dueDate, now) <= 7 ? "Bu hafta" : "Daha sonra";
}

const isSnoozed = (i: InboxItem, now: Date) => !!i.snoozedUntil && new Date(i.snoozedUntil) > now;

function Fact({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[132px_minmax(0,1fr)] gap-3 py-2 text-sm">
      <dt className="text-slate-500">{label}</dt>
      <dd className="min-w-0 text-slate-900">{children}</dd>
    </div>
  );
}

const str = (v: unknown) => (typeof v === "string" ? v : v == null ? "" : String(v));
const dateOf = (v: unknown) => (typeof v === "string" && v ? formatDate(v) : "—");

function Detail({
  item,
  now,
  busy,
  onDone,
  onSnooze,
  onUnsnooze,
  onBack,
}: {
  item: InboxItem;
  now: Date;
  busy: boolean;
  onDone: (action: () => Promise<unknown>, message: string) => void;
  onSnooze: (days: number) => void;
  onUnsnooze: () => void;
  onBack: () => void;
}) {
  const k = KIND[item.kind];
  const d = item.detail;
  const snoozed = isSnoozed(item, now);
  const primary = "inline-flex items-center gap-2 rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-60";
  const secondary = "inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium text-slate-700 ring-1 ring-slate-200 hover:bg-slate-50";

  let facts: React.ReactNode = null;
  let action: React.ReactNode = null;
  switch (item.kind) {
    case "declaration":
      facts = (
        <>
          <Fact label="Beyanname">{str(d.label)}</Fact>
          <Fact label="Dönem">{str(d.periodLabel)}</Fact>
          <Fact label="Son gün">
            {dateOf(item.dueDate)} <span className="text-slate-500">· {dueText(item, now)}</span>
          </Fact>
        </>
      );
      action = (
        <>
          <button
            disabled={busy}
            className={primary}
            onClick={() =>
              onDone(
                () => api("/declarations", { method: "POST", body: JSON.stringify({ companyId: item.company!.id, type: d.type, period: d.period }) }),
                `${item.company!.title} · ${str(d.label)} verildi olarak işaretlendi.`,
              )
            }
          >
            <CheckCheck size={16} /> Verildi olarak işaretle
          </button>
          <Link href="/beyanname" className={secondary}>
            Kontrol ekranında aç <ArrowUpRight size={14} />
          </Link>
        </>
      );
      break;
    case "tebligat":
      facts = (
        <>
          <Fact label="Konu">{str(d.subject) || "—"}</Fact>
          <Fact label="Gönderen">{str(d.sender) || "—"}</Fact>
          <Fact label="Belge no">
            <span className="font-mono text-[13px]">{str(d.documentNo)}</span>
          </Fact>
          <Fact label="Ulaştığı tarih">{dateOf(d.deliveredAt)}</Fact>
          <Fact label="Tebliğ sayılır">
            {dateOf(d.deemedServedAt)}
            <span className="block text-xs text-slate-500">Okunmasa da 5. günün sonunda tebliğ edilmiş sayılır.</span>
          </Fact>
          <Fact label="GİB'de okunma">{d.readAtGib ? dateOf(d.readAtGib) : "Okunmadı"}</Fact>
        </>
      );
      action = (
        <>
          <button
            disabled={busy}
            className={primary}
            onClick={() =>
              onDone(
                () => api(`/tebligat/${str(d.tebligatId)}/review`, { method: "PUT", body: JSON.stringify({ reviewed: true }) }),
                "Tebligat incelendi olarak işaretlendi.",
              )
            }
          >
            <CheckCheck size={16} /> İncelendi
          </button>
          <Link href="/tebligat" className={secondary}>
            e-Tebligat&apos;ta aç <ArrowUpRight size={14} />
          </Link>
        </>
      );
      break;
    case "report":
      facts = (
        <>
          <Fact label="Sigortalı">
            {str(d.fullName)} <span className="font-mono text-xs text-slate-500">{str(d.tckn)}</span>
          </Fact>
          <Fact label="Vaka">{str(d.vaka)}</Fact>
          <Fact label="Rapor">
            {dateOf(d.startDate)} – {dateOf(d.endDate)}
          </Fact>
          <Fact label="İş başı kontrol">{dateOf(d.workControlDate)}</Fact>
          <Fact label="İşyeri">{str(d.workplace)}</Fact>
        </>
      );
      action = (
        <Link href="/sgk" className={primary}>
          SGK ekranında onayla <ArrowUpRight size={14} />
        </Link>
      );
      break;
    case "berat":
      facts = (
        <>
          <Fact label="Dönem">{str(d.periodLabel)}</Fact>
          <Fact label="Son gün">
            {dateOf(item.dueDate)} {item.dueDate && <span className="text-slate-500">· {dueText(item, now)}</span>}
          </Fact>
        </>
      );
      action = (
        <>
          <button
            disabled={busy}
            className={primary}
            onClick={() =>
              onDone(
                () =>
                  api(`/edefter/companies/${item.company!.id}/berats/${str(d.period)}`, {
                    method: "PUT",
                    body: JSON.stringify({ uploadedAt: new Date().toISOString() }),
                  }),
                `${item.company!.title} · ${str(d.periodLabel)} beratı yüklendi olarak işaretlendi.`,
              )
            }
          >
            <CheckCheck size={16} /> Yüklendi olarak işaretle
          </button>
          <Link href="/edefter" className={secondary}>
            e-Defter&apos;de aç <ArrowUpRight size={14} />
          </Link>
        </>
      );
      break;
    case "payroll":
      facts = (
        <>
          <Fact label="Dönem">{str(d.period)}</Fact>
          {d.workplace ? <Fact label="İşyeri">{str(d.workplace)}</Fact> : null}
          {Array.isArray(d.diffs) && (
            <Fact label="Farklar">
              <ul className="list-disc space-y-1 pl-4">
                {(d.diffs as string[]).map((x) => (
                  <li key={x}>{x}</li>
                ))}
              </ul>
            </Fact>
          )}
        </>
      );
      action = (
        <Link href="/bordro" className={primary}>
          {Array.isArray(d.diffs) ? "Bordroda incele" : "Bordro yükle"} <ArrowUpRight size={14} />
        </Link>
      );
      break;
    case "license":
      facts = <Fact label="Bitiş">{dateOf(d.expiresAt)}</Fact>;
      action = (
        <Link href="/odeme" className={primary}>
          Lisansı uzat <ArrowUpRight size={14} />
        </Link>
      );
      break;
  }

  return (
    <article className="flex h-full flex-col">
      <div className="flex items-center gap-2 border-b border-slate-200 px-5 py-3 lg:hidden">
        <button onClick={onBack} className="flex items-center gap-1.5 rounded-md px-2 py-1 text-sm text-slate-600 hover:bg-slate-100">
          <ArrowLeft size={16} /> Listeye dön
        </button>
      </div>
      <div className="flex-1 overflow-y-auto px-6 py-5">
        <p className="flex items-center gap-2 text-xs font-medium text-slate-500">
          <k.icon size={14} /> {k.label}
          {item.severity === "late" && <span className="rounded-full bg-red-50 px-2 py-0.5 font-semibold text-red-700">Gecikti</span>}
          {item.severity === "soon" && <span className="rounded-full bg-amber-50 px-2 py-0.5 font-semibold text-amber-800">Yaklaşıyor</span>}
        </p>
        <h2 className="mt-2 text-xl leading-snug font-bold text-slate-900">{item.title}</h2>
        {item.company && (
          <p className="mt-1 text-sm text-slate-600">
            {item.company.title}
            {item.company.taxNumber && (
              <>
                {" · "}
                <Link href={`/firmalar?q=${encodeURIComponent(item.company.taxNumber)}`} className="font-mono text-[13px] text-brand-700 hover:underline">
                  {item.company.taxNumber}
                </Link>
              </>
            )}
          </p>
        )}

        <dl className="mt-5 divide-y divide-slate-100 border-y border-slate-100">{facts}</dl>

        <div className="mt-5 flex flex-wrap gap-2">{action}</div>

        <div className="mt-8">
          <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold tracking-wide text-slate-500 uppercase">
            <AlarmClock size={13} /> Sonra hatırlat
          </p>
          {snoozed ? (
            <p className="flex flex-wrap items-center gap-2 text-sm text-slate-600">
              {new Date(item.snoozedUntil!).toLocaleString("tr-TR", { weekday: "long", day: "numeric", month: "long", hour: "2-digit", minute: "2-digit" })}{" "}
              tarihine ertelendi.
              <button disabled={busy} onClick={onUnsnooze} className="font-semibold text-brand-700 hover:underline">
                Ertelemeyi kaldır
              </button>
            </p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {[
                [1, "Yarın sabah"],
                [3, "3 gün sonra"],
                [7, "Gelecek hafta"],
              ].map(([days, label]) => (
                <button key={days} disabled={busy} onClick={() => onSnooze(days as number)} className="rounded-full px-3 py-1.5 text-sm text-slate-700 ring-1 ring-slate-200 hover:bg-slate-50 disabled:opacity-60">
                  {label}
                </button>
              ))}
            </div>
          )}
          <p className="mt-2 text-xs text-slate-500">Erteleme büro genelinde geçerlidir; iş, o gün sabah 08.00&apos;de listeye geri döner.</p>
        </div>
      </div>
    </article>
  );
}

export default function InboxView() {
  const [data, setData] = useState<InboxResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [folder, setFolder] = useState<Folder>("all");
  const [kind, setKind] = useState<InboxKind | "">("");
  const [query, setQuery] = useState("");
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [mobileDetail, setMobileDetail] = useState(false);
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const load = useCallback(
    (isAlive: () => boolean = () => true) =>
      api<InboxResponse>("/inbox").then((d) => {
        if (isAlive()) setData(d);
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

  const now = useMemo(() => (data ? new Date(data.generatedAt) : new Date(0)), [data]);

  const visible = useMemo(() => {
    if (!data) return [];
    const q = fold(query.trim());
    return data.items.filter((i) => {
      const snoozed = isSnoozed(i, now);
      if (folder === "snoozed" ? !snoozed : snoozed) return false;
      if (folder === "late" && i.severity !== "late") return false;
      if (folder === "soon" && i.severity !== "soon") return false;
      if (kind && i.kind !== kind) return false;
      if (q && !fold(`${i.title} ${i.subtitle} ${i.company?.title ?? ""} ${i.company?.taxNumber ?? ""}`).includes(q)) return false;
      return true;
    });
  }, [data, folder, kind, query, now]);

  const selected = visible.find((i) => i.key === selectedKey) ?? visible[0] ?? null;

  // ↑ ↓ veya j / k ile listede gezinme
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const t = e.target as HTMLElement;
      if (/^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName) || t.isContentEditable || e.ctrlKey || e.metaKey || e.altKey) return;
      const down = e.key === "ArrowDown" || e.key === "j";
      const up = e.key === "ArrowUp" || e.key === "k";
      if (!down && !up) return;
      e.preventDefault();
      const idx = selected ? visible.findIndex((i) => i.key === selected.key) : -1;
      const next = visible[Math.max(0, Math.min(visible.length - 1, idx + (down ? 1 : -1)))];
      if (next) setSelectedKey(next.key);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [visible, selected]);

  useEffect(() => {
    if (selected) listRef.current?.querySelector<HTMLElement>(`[data-key="${CSS.escape(selected.key)}"]`)?.scrollIntoView({ block: "nearest" });
  }, [selected]);

  /** İşlemden sonra listeyi yeniler ve bir sonraki işi seçer */
  async function afterChange(message: string) {
    const idx = selected ? visible.findIndex((i) => i.key === selected.key) : -1;
    const fallback = visible[idx + 1] ?? visible[idx - 1] ?? null;
    await load();
    setSelectedKey(fallback?.key ?? null);
    setToast(message);
    setTimeout(() => setToast((t) => (t === message ? null : t)), 4000);
  }

  async function run(action: () => Promise<unknown>, message: string) {
    setBusy(true);
    try {
      await action();
      await afterChange(message);
      setMobileDetail(false);
    } catch (e) {
      setToast((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  if (error) return <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>;
  if (!data) return <p className="text-sm text-slate-500">İşler toplanıyor…</p>;

  const c = data.counts;
  const folders: { id: Folder; label: string; icon: LucideIcon; count: number; tone?: string }[] = [
    { id: "all", label: "Tümü", icon: Inbox, count: c.all },
    { id: "late", label: "Gecikenler", icon: Flame, count: c.late, tone: "text-red-600" },
    { id: "soon", label: "Yaklaşanlar", icon: Timer, count: c.soon, tone: "text-amber-600" },
    { id: "snoozed", label: "Ertelenenler", icon: MoonStar, count: c.snoozed },
  ];

  const bucketFor = (i: InboxItem) => (folder === "snoozed" ? "Ertelenenler" : bucketOf(i, now));
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <p className="text-sm text-slate-500">{new Date().toLocaleDateString("tr-TR", { weekday: "long", day: "numeric", month: "long" })}</p>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            {c.all} açık iş{c.late ? <span className="text-red-600"> · {c.late} gecikmiş</span> : null}
          </h1>
        </div>
        {toast && (
          <p role="status" className="rounded-full bg-slate-900 px-4 py-1.5 text-sm text-white shadow">
            {toast}
          </p>
        )}
      </div>

      <div className="grid h-[calc(100vh-11rem)] min-h-[520px] overflow-hidden rounded-2xl border border-slate-200 bg-white lg:grid-cols-[208px_minmax(0,1fr)_minmax(0,440px)]">
        {/* Klasörler */}
        <nav aria-label="Klasörler" className="hidden flex-col gap-0.5 border-r border-slate-200 bg-slate-50/60 p-3 lg:flex">
          {folders.map((f) => (
            <button
              key={f.id}
              onClick={() => setFolder(f.id)}
              className={`flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm ${folder === f.id ? "bg-white font-semibold text-slate-900 shadow-sm ring-1 ring-slate-200" : "text-slate-600 hover:bg-white"}`}
            >
              <f.icon size={16} className={f.tone ?? "text-slate-500"} />
              <span className="flex-1 text-left">{f.label}</span>
              <span className="text-xs text-slate-500 tabular-nums">{f.count}</span>
            </button>
          ))}
          <p className="mt-4 mb-1 px-2.5 text-[11px] font-semibold tracking-wide text-slate-400 uppercase">Türe göre</p>
          <button
            onClick={() => setKind("")}
            className={`rounded-lg px-2.5 py-1.5 text-left text-sm ${kind === "" ? "font-semibold text-slate-900" : "text-slate-600 hover:bg-white"}`}
          >
            Hepsi
          </button>
          {KIND_ORDER.filter((kk) => c.byKind[kk] > 0 || kind === kk).map((kk) => {
            const K = KIND[kk];
            return (
              <button
                key={kk}
                onClick={() => setKind(kind === kk ? "" : kk)}
                className={`flex items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-sm ${kind === kk ? "bg-white font-semibold text-slate-900 shadow-sm ring-1 ring-slate-200" : "text-slate-600 hover:bg-white"}`}
              >
                <K.icon size={15} className="text-slate-500" />
                <span className="flex-1 text-left">{K.label}</span>
                <span className="text-xs text-slate-500 tabular-nums">{c.byKind[kk]}</span>
              </button>
            );
          })}
        </nav>

        {/* Liste */}
        <section className={`flex min-h-0 flex-col border-r border-slate-200 ${mobileDetail ? "hidden lg:flex" : "flex"}`} aria-label="İşler">
          <div className="space-y-2 border-b border-slate-200 p-3">
            <label className="flex h-9 items-center gap-2 rounded-lg bg-slate-100 px-3">
              <Search size={15} className="text-slate-400" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Mükellef, VKN veya iş ara"
                className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-slate-400"
                aria-label="İşlerde ara"
              />
            </label>
            <div className="flex gap-1.5 overflow-x-auto lg:hidden">
              {folders.map((f) => (
                <button
                  key={f.id}
                  onClick={() => setFolder(f.id)}
                  className={`shrink-0 rounded-full px-3 py-1 text-xs ${folder === f.id ? "bg-slate-900 text-white" : "bg-slate-100 text-slate-700"}`}
                >
                  {f.label} {f.count}
                </button>
              ))}
            </div>
          </div>
          <div ref={listRef} className="min-h-0 flex-1 overflow-y-auto">
            {visible.length === 0 && (
              <div className="flex h-full flex-col items-center justify-center gap-2 p-8 text-center text-sm text-slate-500">
                <CheckCheck size={28} className="text-emerald-500" />
                {query ? "Aramanızla eşleşen iş yok." : folder === "snoozed" ? "Ertelenmiş iş yok." : "Bu klasörde bekleyen iş yok."}
              </div>
            )}
            {visible.map((i, idx) => {
              const bucket = bucketFor(i);
              const header = idx === 0 || bucketFor(visible[idx - 1]) !== bucket ? bucket : null;
              const K = KIND[i.kind];
              const active = selected?.key === i.key;
              return (
                <div key={i.key}>
                  {header && (
                    <p className="sticky top-0 z-10 border-b border-slate-100 bg-white/95 px-4 py-1.5 text-[11px] font-semibold tracking-wide text-slate-400 uppercase backdrop-blur">
                      {header}
                    </p>
                  )}
                  <button
                    data-key={i.key}
                    onClick={() => {
                      setSelectedKey(i.key);
                      setMobileDetail(true);
                    }}
                    aria-current={active ? "true" : undefined}
                    className={`relative flex w-full gap-3 border-b border-slate-100 px-4 py-3 text-left ${active ? "bg-brand-50" : "hover:bg-slate-50"}`}
                  >
                    {active && <span className="absolute inset-y-0 left-0 w-[3px] bg-brand-600" />}
                    <K.icon size={16} className={`mt-0.5 shrink-0 ${i.severity === "late" ? "text-red-500" : i.severity === "soon" ? "text-amber-500" : "text-slate-400"}`} />
                    <span className="min-w-0 flex-1">
                      <span className="flex items-baseline justify-between gap-2">
                        <span className="truncate text-sm font-semibold text-slate-900">{i.company?.title ?? i.title}</span>
                        <span
                          className={`shrink-0 text-xs tabular-nums ${i.severity === "late" ? "font-semibold text-red-600" : i.severity === "soon" ? "font-semibold text-amber-700" : "text-slate-500"}`}
                        >
                          {dueText(i, now)}
                        </span>
                      </span>
                      <span className="block truncate text-sm text-slate-700">{i.company ? i.title : ""}</span>
                      <span className="block truncate text-xs text-slate-500">{i.subtitle}</span>
                    </span>
                  </button>
                </div>
              );
            })}
          </div>
          <p className="hidden border-t border-slate-200 px-4 py-2 text-[11px] text-slate-400 lg:block">
            {visible.length} iş · <kbd className="rounded border border-slate-200 px-1">↑</kbd> <kbd className="rounded border border-slate-200 px-1">↓</kbd> ile gezinin
          </p>
        </section>

        {/* Ayrıntı */}
        <section className={`min-h-0 ${mobileDetail ? "block" : "hidden"} lg:block`} aria-label="İş ayrıntısı">
          {selected ? (
            <Detail
              key={selected.key}
              item={selected}
              now={now}
              busy={busy}
              onDone={run}
              onSnooze={(days) => run(() => api("/inbox/snooze", { method: "POST", body: JSON.stringify({ key: selected.key, days }) }), "İş ertelendi.")}
              onUnsnooze={() => run(() => api("/inbox/unsnooze", { method: "POST", body: JSON.stringify({ key: selected.key }) }), "Erteleme kaldırıldı.")}
              onBack={() => setMobileDetail(false)}
            />
          ) : (
            <div className="flex h-full items-center justify-center p-8 text-sm text-slate-500">Soldan bir iş seçin.</div>
          )}
        </section>
      </div>
    </div>
  );
}
