"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  Building2,
  Check,
  FileText,
  FileUp,
  Mail,
  MessageCircle,
  Phone,
  Plus,
  Search,
  ShieldCheck,
  User,
  Users,
  type LucideIcon,
} from "lucide-react";
import { api, companyTypeLabel, type Company, type CompanyType, type Me } from "@/lib/api";
import CompanyImportModal from "./CompanyImportModal";

const emptyForm = { title: "", taxNumber: "", type: "SIRKET" as CompanyType, taxOffice: "" };

type Segment = "all" | "active" | "passive" | CompanyType;
interface Obligation {
  type: string;
  label: string;
  active: boolean;
}

const typeIcon: Record<CompanyType, LucideIcon> = { SIRKET: Building2, SAHIS: User, BASIT_USUL: User };

function initials(name: string) {
  const w = name.trim().split(/\s+/).filter(Boolean);
  return ((w[0]?.[0] ?? "") + (w[1]?.[0] ?? "")).toLocaleUpperCase("tr") || "—";
}
const onlyDigits = (s: string) => s.replace(/\D/g, "");

function DetailPanel({ company, isAdmin, onToggleActive }: { company: Company; isAdmin: boolean; onToggleActive: (c: Company) => void }) {
  const [obl, setObl] = useState<Obligation[] | null>(null);
  useEffect(() => {
    let alive = true;
    api<{ items: Obligation[] }>(`/companies/${company.id}/obligations`)
      .then((r) => alive && setObl(r.items))
      .catch(() => alive && setObl([]));
    return () => {
      alive = false;
    };
  }, [company.id]);

  const TypeIcon = typeIcon[company.type];
  const phone = company.phone ? onlyDigits(company.phone) : null;
  const activeObl = (obl ?? []).filter((o) => o.active);

  return (
    <div className="flex h-full flex-col">
      {/* Üst: firma kimliği + hızlı iletişim */}
      <div className="border-b border-slate-200 p-5">
        <div className="flex items-start gap-3">
          <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-sm font-semibold text-brand-700">
            {initials(company.title)}
          </span>
          <div className="min-w-0 flex-1">
            <h2 className="truncate text-lg font-semibold tracking-tight text-slate-900">{company.title}</h2>
            <p className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-sm text-slate-500">
              <span className="inline-flex items-center gap-1">
                <TypeIcon size={14} strokeWidth={1.5} /> {companyTypeLabel[company.type]}
              </span>
              <span className="text-slate-300">·</span>
              <span className="font-mono text-[13px]">{company.taxNumber}</span>
            </p>
            <p className="mt-1 text-sm text-slate-500">
              Vergi dairesi: <span className="text-slate-700">{company.taxOffice ?? "—"}</span>
            </p>
          </div>
          <button
            onClick={() => isAdmin && onToggleActive(company)}
            disabled={!isAdmin}
            title={isAdmin ? "Durumu değiştir" : undefined}
            className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-medium ${
              company.isActive ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-500"
            } ${isAdmin ? "hover:opacity-80" : "cursor-default"}`}
          >
            {company.isActive ? "Aktif" : "Pasif"}
          </button>
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          {phone ? (
            <>
              <a
                href={`https://wa.me/${phone.startsWith("90") ? phone : `90${phone.replace(/^0/, "")}`}`}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1.5 rounded-lg bg-brand-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-brand-700"
              >
                <MessageCircle size={15} strokeWidth={1.5} /> WhatsApp
              </a>
              <a
                href={`tel:${company.phone}`}
                className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium text-slate-700 ring-1 ring-slate-200 hover:bg-slate-50"
              >
                <Phone size={15} strokeWidth={1.5} /> Ara
              </a>
            </>
          ) : (
            <span className="text-xs text-slate-400">Telefon kayıtlı değil</span>
          )}
          {company.email && (
            <a
              href={`mailto:${company.email}`}
              className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium text-slate-700 ring-1 ring-slate-200 hover:bg-slate-50"
            >
              <Mail size={15} strokeWidth={1.5} /> E-posta
            </a>
          )}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-5">
        {/* Mükellefiyetler */}
        <section>
          <h3 className="flex items-center gap-2 text-[13px] font-semibold text-slate-900">
            <ShieldCheck size={16} strokeWidth={1.5} className="text-slate-400" /> Mükellefiyetler
          </h3>
          {obl === null ? (
            <p className="mt-3 text-sm text-slate-400">Yükleniyor…</p>
          ) : activeObl.length === 0 ? (
            <p className="mt-3 text-sm text-slate-400">Tanımlı beyanname yükümlülüğü yok.</p>
          ) : (
            <div className="mt-3 flex flex-wrap gap-2">
              {activeObl.map((o) => (
                <span key={o.type} className="inline-flex items-center gap-1.5 rounded-lg bg-slate-50 px-2.5 py-1.5 text-xs font-medium text-slate-700 ring-1 ring-slate-200">
                  <Check size={13} strokeWidth={2} className="text-emerald-600" /> {o.label}
                </span>
              ))}
            </div>
          )}
        </section>

        {/* Hızlı erişim — firmanın kayıtlarına filtreli gidiş */}
        <section className="mt-6">
          <h3 className="text-[13px] font-semibold text-slate-900">Bu mükellef için</h3>
          <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
            {(
              [
                { href: `/beyanname?q=${encodeURIComponent(company.taxNumber)}`, icon: FileText, label: "Beyanname durumu", sub: "kontrol ekranında aç" },
                { href: `/edefter?q=${encodeURIComponent(company.taxNumber)}`, icon: FileText, label: "e-Defter beratları", sub: "yükleme durumu" },
                { href: `/sgk?q=${encodeURIComponent(company.taxNumber)}`, icon: Users, label: "SGK / bordro", sub: "işyeri ve çalışanlar" },
                { href: `/tebligat?q=${encodeURIComponent(company.taxNumber)}`, icon: Mail, label: "e-Tebligat", sub: "gelen tebligatlar" },
              ] as const
            ).map((a) => (
              <Link
                key={a.href}
                href={a.href}
                className="group flex items-center gap-3 rounded-lg border border-slate-200 px-3 py-2.5 transition hover:border-brand-300 hover:bg-brand-50/40"
              >
                <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-500 group-hover:bg-white group-hover:text-brand-600">
                  <a.icon size={16} strokeWidth={1.5} />
                </span>
                <span className="min-w-0">
                  <span className="block text-sm font-medium text-slate-900">{a.label}</span>
                  <span className="block text-xs text-slate-500">{a.sub}</span>
                </span>
              </Link>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}

export default function CompaniesPage({ initialQuery = "" }: { initialQuery?: string }) {
  const [items, setItems] = useState<Company[]>([]);
  const [q, setQ] = useState(initialQuery);
  const [seg, setSeg] = useState<Segment>("all");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    api<Me>("/auth/me").then((m) => alive && setIsAdmin(m.role === "ADMIN")).catch(() => {});
    return () => {
      alive = false;
    };
  }, []);

  const load = useCallback(() => {
    const params = new URLSearchParams();
    if (q) params.set("q", q);
    api<Company[]>(`/companies?${params}`).then(setItems).catch((e) => setError(e.message));
  }, [q]);

  useEffect(() => {
    const t = setTimeout(load, 250);
    return () => clearTimeout(t);
  }, [load]);

  const counts = useMemo(() => {
    const c = { all: items.length, active: 0, passive: 0, SIRKET: 0, SAHIS: 0, BASIT_USUL: 0 } as Record<Segment, number>;
    for (const it of items) {
      if (it.isActive) c.active++;
      else c.passive++;
      c[it.type]++;
    }
    return c;
  }, [items]);

  const visible = useMemo(
    () =>
      items.filter((c) => {
        if (seg === "active") return c.isActive;
        if (seg === "passive") return !c.isActive;
        if (seg === "SIRKET" || seg === "SAHIS" || seg === "BASIT_USUL") return c.type === seg;
        return true;
      }),
    [items, seg],
  );

  const selected = visible.find((c) => c.id === selectedId) ?? visible[0] ?? null;

  async function create(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      const c = await api<Company>("/companies", { method: "POST", body: JSON.stringify({ ...form, taxOffice: form.taxOffice || undefined }) });
      setForm(emptyForm);
      setShowForm(false);
      setSelectedId(c.id);
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Kayıt başarısız");
    }
  }

  async function toggleActive(c: Company) {
    await api(`/companies/${c.id}`, { method: "PATCH", body: JSON.stringify({ isActive: !c.isActive }) });
    load();
  }

  const segments: { id: Segment; label: string }[] = [
    { id: "all", label: "Tümü" },
    { id: "active", label: "Aktif" },
    { id: "passive", label: "Pasif" },
    { id: "SIRKET", label: companyTypeLabel.SIRKET },
    { id: "SAHIS", label: companyTypeLabel.SAHIS },
    { id: "BASIT_USUL", label: companyTypeLabel.BASIT_USUL },
  ];

  return (
    <div className="space-y-4">
      {/* Üst bar: başlık + durum rozeti + arama + aksiyonlar */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-slate-900">Mükellef radarı</h1>
          <p className="mt-0.5 text-sm text-slate-500">
            <b className="font-semibold text-slate-700 tabular-nums">{counts.all}</b> mükellef ·{" "}
            <b className="font-semibold text-emerald-600 tabular-nums">{counts.active}</b> aktif
            {counts.passive > 0 && (
              <>
                {" · "}
                <b className="font-semibold text-slate-500 tabular-nums">{counts.passive}</b> pasif
              </>
            )}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <label className="flex h-9 w-full items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 focus-within:border-brand-400 sm:w-64">
            <Search size={15} strokeWidth={1.5} className="text-slate-400" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Ünvan veya VKN ara"
              className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-slate-400"
              aria-label="Mükellef ara"
            />
          </label>
          {isAdmin && (
            <button
              onClick={() => setShowImport(true)}
              className="inline-flex h-9 items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              <FileUp size={15} strokeWidth={1.5} /> Excel&apos;den aktar
            </button>
          )}
          <button
            onClick={() => setShowForm((s) => !s)}
            className="inline-flex h-9 items-center gap-2 rounded-lg bg-brand-600 px-3 text-sm font-medium text-white hover:bg-brand-700"
          >
            <Plus size={16} strokeWidth={1.5} /> Mükellef ekle
          </button>
        </div>
      </div>

      {notice && <p className="rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-800">{notice}</p>}
      {error && <p className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p>}

      {showImport && (
        <CompanyImportModal
          onClose={() => setShowImport(false)}
          onDone={(m) => {
            setShowImport(false);
            setNotice(m);
            load();
          }}
        />
      )}

      {showForm && (
        <form onSubmit={create} className="grid grid-cols-1 gap-3 rounded-xl border border-slate-200 bg-white p-4 sm:grid-cols-2 lg:grid-cols-5">
          <input required placeholder="Ünvan / Ad Soyad" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} className="rounded-lg border border-slate-300 px-3 py-2 text-sm lg:col-span-2" />
          <input required placeholder="VKN / TCKN" inputMode="numeric" value={form.taxNumber} onChange={(e) => setForm({ ...form, taxNumber: e.target.value.replace(/\D/g, "").slice(0, 11) })} className="rounded-lg border border-slate-300 px-3 py-2 text-sm" />
          <select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value as CompanyType })} className="rounded-lg border border-slate-300 px-3 py-2 text-sm">
            {Object.entries(companyTypeLabel).map(([v, l]) => (
              <option key={v} value={v}>{l}</option>
            ))}
          </select>
          <input placeholder="Vergi dairesi" value={form.taxOffice} onChange={(e) => setForm({ ...form, taxOffice: e.target.value })} className="rounded-lg border border-slate-300 px-3 py-2 text-sm" />
          <button className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700 sm:col-span-2 lg:col-span-5">Kaydet</button>
        </form>
      )}

      {/* Segment şeridi */}
      <div role="tablist" aria-label="Süzgeç" className="flex flex-wrap gap-1 rounded-xl border border-slate-200 bg-white p-1">
        {segments.map((s) => (
          <button
            key={s.id}
            role="tab"
            aria-selected={seg === s.id}
            onClick={() => setSeg(s.id)}
            className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm transition ${
              seg === s.id ? "bg-brand-600 font-medium text-white" : "text-slate-600 hover:bg-slate-100"
            }`}
          >
            {s.label}
            <span className={`rounded-full px-1.5 text-xs tabular-nums ${seg === s.id ? "bg-white/20 text-white" : "bg-slate-100 text-slate-500"}`}>{counts[s.id]}</span>
          </button>
        ))}
      </div>

      {/* Split-view: sol liste · sağ röntgen */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
        <div className="h-[calc(100vh-18rem)] min-h-[460px] overflow-y-auto rounded-xl border border-slate-200 bg-white">
          {visible.length === 0 ? (
            <div className="flex h-full flex-col items-center justify-center gap-2 p-8 text-center text-sm text-slate-500">
              <Building2 size={26} strokeWidth={1.5} className="text-slate-300" />
              {q ? "Aramayla eşleşen mükellef yok." : "Bu süzgeçte mükellef yok."}
            </div>
          ) : (
            <ul className="divide-y divide-slate-100">
              {visible.map((c) => {
                const TypeIcon = typeIcon[c.type];
                const active = selected?.id === c.id;
                return (
                  <li key={c.id}>
                    <button
                      onClick={() => setSelectedId(c.id)}
                      aria-current={active ? "true" : undefined}
                      className={`relative flex w-full items-center gap-3 px-4 py-3 text-left transition ${active ? "bg-brand-50" : "hover:bg-slate-50"}`}
                    >
                      {active && <span className="absolute inset-y-0 left-0 w-0.5 bg-brand-600" />}
                      <span className={`flex size-9 shrink-0 items-center justify-center rounded-lg text-xs font-semibold ${active ? "bg-brand-100 text-brand-700" : "bg-slate-100 text-slate-500"}`}>
                        {initials(c.title)}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="flex items-center gap-2">
                          <span className="truncate text-sm font-medium text-slate-900">{c.title}</span>
                        </span>
                        <span className="mt-0.5 flex items-center gap-2 text-xs text-slate-500">
                          <span className="font-mono">{c.taxNumber}</span>
                          <span className="text-slate-300">·</span>
                          <span className="inline-flex items-center gap-1">
                            <TypeIcon size={12} strokeWidth={1.5} /> {companyTypeLabel[c.type]}
                          </span>
                        </span>
                      </span>
                      <span
                        className={`size-2 shrink-0 rounded-full ${c.isActive ? "bg-emerald-500" : "bg-slate-300"}`}
                        aria-label={c.isActive ? "Aktif" : "Pasif"}
                      />
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        <div className="h-[calc(100vh-18rem)] min-h-[460px] overflow-hidden rounded-xl border border-slate-200 bg-white">
          {selected ? (
            <DetailPanel key={selected.id} company={selected} isAdmin={isAdmin} onToggleActive={toggleActive} />
          ) : (
            <div className="flex h-full flex-col items-center justify-center gap-2 p-8 text-center text-sm text-slate-500">
              <Users size={28} strokeWidth={1.5} className="text-slate-300" />
              Soldan bir mükellef seçin.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
