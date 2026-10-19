"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, Building2, CornerDownLeft, Moon, Search, Sun, Upload, type LucideIcon } from "lucide-react";
import { api, companyTypeLabel, type Company } from "@/lib/api";
import { NAV } from "./nav";
import { setTheme } from "./ThemeToggle";

interface Command {
  id: string;
  group: string;
  label: string;
  hint?: string;
  icon: LucideIcon;
  run: () => void;
}

/** Türkçe karakterleri sadeleştirip küçük harfe çevirir: "Şahıs" → "sahis" */
const fold = (s: string) =>
  s
    .replace(/İ/g, "i")
    .replace(/I/g, "ı")
    .toLocaleLowerCase("tr")
    .replace(/[çğıöşü]/g, (c) => ({ ç: "c", ğ: "g", ı: "i", ö: "o", ş: "s", ü: "u" })[c]!);

export function CommandPalette({ open, onClose, isAdmin }: { open: boolean; onClose: () => void; isAdmin: boolean }) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [companies, setCompanies] = useState<Company[]>([]);
  const [active, setActive] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const go = (href: string) => {
    onClose();
    router.push(href);
  };

  // Mükellef araması (yazmayı bıraktıktan kısa süre sonra)
  useEffect(() => {
    const q = query.trim();
    if (q.length < 2) return;
    let alive = true;
    const t = setTimeout(() => {
      api<Company[]>(`/companies?q=${encodeURIComponent(q)}`)
        .then((c) => alive && setCompanies(c.slice(0, 6)))
        .catch(() => {});
    }, 180);
    return () => {
      alive = false;
      clearTimeout(t);
    };
  }, [query]);

  const commands = useMemo<Command[]>(() => {
    const q = fold(query.trim());
    const match = (...texts: (string | undefined)[]) => !q || texts.some((t) => t && fold(t).includes(q));
    const pages: Command[] = NAV.flatMap((g) => g.items)
      .filter((i) => (!i.adminOnly || isAdmin) && match(i.label, i.keywords))
      .map((i) => ({ id: `page:${i.href}`, group: "Sayfalar", label: i.label, icon: i.icon, run: () => go(i.href) }));
    const actions: Command[] = [
      { id: "act:invoice", group: "İşlemler", label: "Fatura yükle (UBL / ZIP)", icon: Upload, run: () => go("/faturalar"), hint: "Faturalar" },
      { id: "act:payroll", group: "İşlemler", label: "Bordro yükle", icon: Upload, run: () => go("/bordro"), hint: "Bordro" },
      { id: "act:dark", group: "İşlemler", label: "Koyu temaya geç", icon: Moon, run: () => (setTheme("dark"), onClose()) },
      { id: "act:light", group: "İşlemler", label: "Açık temaya geç", icon: Sun, run: () => (setTheme("light"), onClose()) },
    ].filter((a) => match(a.label, a.hint));
    const found: Command[] =
      query.trim().length >= 2
        ? companies.map((c) => ({
            id: `co:${c.id}`,
            group: "Mükellefler",
            label: c.title,
            hint: `${c.taxNumber} · ${companyTypeLabel[c.type]}`,
            icon: Building2,
            run: () => go(`/firmalar?q=${encodeURIComponent(c.taxNumber)}`),
          }))
        : [];
    return [...found, ...pages, ...actions];
    // go/onClose her render'da yenidir ama davranışları aynıdır
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query, companies, isAdmin]);

  const current = Math.min(active, Math.max(0, commands.length - 1));

  useEffect(() => {
    listRef.current?.querySelector<HTMLElement>(`[data-index="${current}"]`)?.scrollIntoView({ block: "nearest" });
  }, [current]);

  if (!open) return null;

  function onKey(e: React.KeyboardEvent) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((a) => (commands.length ? (Math.min(a, commands.length - 1) + 1) % commands.length : 0));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((a) => (commands.length ? (Math.min(a, commands.length - 1) - 1 + commands.length) % commands.length : 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      commands[current]?.run();
    } else if (e.key === "Escape") {
      onClose();
    }
  }

  let lastGroup = "";
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/50 p-4 pt-[12vh]" onClick={onClose}>
      <div
        role="dialog"
        aria-label="Komut paleti"
        className="w-full max-w-xl overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-3 border-b border-slate-200 px-4">
          <Search size={18} className="text-slate-400" />
          <input
            ref={inputRef}
            autoFocus
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setActive(0);
              if (e.target.value.trim().length < 2) setCompanies([]);
            }}
            onKeyDown={onKey}
            placeholder="Mükellef, sayfa veya işlem ara…"
            className="h-14 flex-1 bg-transparent text-[15px] outline-none placeholder:text-slate-400"
            aria-label="Ara"
          />
          <kbd className="rounded border border-slate-200 px-1.5 py-0.5 text-[10px] text-slate-500">Esc</kbd>
        </div>
        <div ref={listRef} className="max-h-[50vh] overflow-y-auto p-2">
          {commands.length === 0 && <p className="px-3 py-8 text-center text-sm text-slate-500">Sonuç yok</p>}
          {commands.map((c, i) => {
            const header = c.group !== lastGroup ? c.group : null;
            lastGroup = c.group;
            const Icon = c.icon;
            return (
              <div key={c.id}>
                {header && <p className="px-3 pt-2 pb-1 text-[11px] font-semibold tracking-wide text-slate-400 uppercase">{header}</p>}
                <button
                  data-index={i}
                  onMouseMove={() => setActive(i)}
                  onClick={c.run}
                  className={`flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm ${i === current ? "bg-brand-50 text-brand-900" : "text-slate-700"}`}
                >
                  <Icon size={16} className={i === current ? "text-brand-600" : "text-slate-400"} />
                  <span className="min-w-0 flex-1 truncate">{c.label}</span>
                  {c.hint && <span className="shrink-0 text-xs text-slate-400">{c.hint}</span>}
                  {i === current && (c.group === "Mükellefler" ? <ArrowRight size={14} /> : <CornerDownLeft size={14} className="text-brand-500" />)}
                </button>
              </div>
            );
          })}
        </div>
        <div className="flex gap-4 border-t border-slate-200 px-4 py-2 text-[11px] text-slate-400">
          <span>↑ ↓ gezin</span>
          <span>Enter aç</span>
          <span>Esc kapat</span>
        </div>
      </div>
    </div>
  );
}
