"use client";

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { CircleHelp, LogOut, PanelLeftClose, PanelLeftOpen } from "lucide-react";
import type { Me } from "@/lib/api";
import { NAV, isActivePath, type NavItem } from "@/components/shell/nav";
import { Logo } from "@/components/shell/Logo";
import { ThemeToggle } from "@/components/shell/ThemeToggle";
import { useHasUnseenChanges } from "@/components/shell/changelog-seen";

// Menünün daralmış/genişçe tercihi tarayıcıda tutulur (tema ve "Yenilikler" ile aynı desen: sunucuda her zaman genişçe).
const COLLAPSE_KEY = "mt_sidebar_collapsed";
const listeners = new Set<() => void>();
function subscribe(cb: () => void) {
  listeners.add(cb);
  window.addEventListener("storage", cb);
  return () => {
    listeners.delete(cb);
    window.removeEventListener("storage", cb);
  };
}
function readCollapsed() {
  try {
    return localStorage.getItem(COLLAPSE_KEY) === "1";
  } catch {
    return false;
  }
}
function useCollapsed() {
  return useSyncExternalStore(subscribe, readCollapsed, () => false);
}
function toggleCollapsed() {
  try {
    localStorage.setItem(COLLAPSE_KEY, readCollapsed() ? "0" : "1");
  } catch {
    // depolama kapalıysa yok say
  }
  listeners.forEach((l) => l());
}

const visible = (items: NavItem[], me: Me | null) => items.filter((i) => !i.adminOnly || me?.role === "ADMIN");

function initialsOf(name: string | undefined) {
  return (name ?? "")
    .split(" ")
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toLocaleUpperCase("tr");
}

/** Dışına tıklanınca veya Esc ile kapanan küçük açılır menü */
function Popover({ open, onClose, children, className = "" }: { open: boolean; onClose: () => void; children: React.ReactNode; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    const onEsc = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    const t = setTimeout(() => document.addEventListener("mousedown", onDown), 0);
    document.addEventListener("keydown", onEsc);
    return () => {
      clearTimeout(t);
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onEsc);
    };
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div ref={ref} role="menu" className={`absolute z-40 w-60 rounded-xl border border-slate-200 bg-white p-2 shadow-xl ${className}`}>
      {children}
    </div>
  );
}

function PopItem({ item, onNavigate, dot }: { item: NavItem; onNavigate: () => void; dot?: boolean }) {
  const Icon = item.icon;
  return (
    <Link href={item.href} onClick={onNavigate} role="menuitem" className="flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm text-slate-700 hover:bg-slate-100">
      <Icon size={16} className="text-slate-500" />
      <span className="flex-1">{item.label}</span>
      {dot && <span className="size-2 rounded-full bg-amber-500" aria-label="Okunmamış yenilik var" />}
    </Link>
  );
}

/** Tek menü bağlantısı. Daralmışken yazı gizli, üzerine gelince ipucu balonu çıkar. */
function NavLink({ item, collapsed, active }: { item: NavItem; collapsed: boolean; active: boolean }) {
  const Icon = item.icon;
  return (
    <Link
      href={item.href}
      aria-label={collapsed ? item.label : undefined}
      aria-current={active ? "page" : undefined}
      title={collapsed ? item.label : undefined}
      className={`group relative flex items-center rounded-xl text-sm transition-colors ${collapsed ? "justify-center p-2.5" : "gap-3 px-3 py-2"} ${
        active ? "bg-brand-600 font-medium text-white shadow-sm" : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
      }`}
    >
      <Icon size={19} className="shrink-0" />
      {!collapsed && <span className="min-w-0 flex-1 truncate">{item.label}</span>}
      {collapsed && (
        <span className="pointer-events-none absolute left-full z-40 ml-3 hidden rounded-md bg-slate-900 px-2 py-1 text-xs font-medium whitespace-nowrap text-white shadow group-hover:block group-focus-visible:block">
          {item.label}
        </span>
      )}
    </Link>
  );
}

/** Masaüstü: açılır kapanır yan menü. Daralmış halde yalnız ikon, genişçe halde ikon + yazı + grup başlıkları. */
export function Sidebar({ me, onLogout }: { me: Me | null; onLogout: () => void }) {
  const pathname = usePathname();
  const unseen = useHasUnseenChanges();
  const collapsed = useCollapsed();
  const [helpOpen, setHelpOpen] = useState(false);
  const [accountOpen, setAccountOpen] = useState(false);
  const closeHelp = useCallback(() => setHelpOpen(false), []);
  const closeAccount = useCallback(() => setAccountOpen(false), []);

  const help = NAV.filter((g) => g.area === "help").flatMap((g) => g.items);
  const account = visible(NAV.filter((g) => g.area === "account").flatMap((g) => g.items), me);
  const accountActive = account.some((i) => isActivePath(i.href, pathname));
  const helpActive = help.some((i) => isActivePath(i.href, pathname));

  return (
    <nav
      aria-label="Ana menü"
      className={`flex h-full flex-col border-r border-slate-200 bg-white transition-[width] duration-200 ${collapsed ? "w-[72px]" : "w-60"}`}
    >
      {/* Üst: logo + aç/kapa düğmesi */}
      <div className={`flex h-14 items-center border-b border-slate-100 ${collapsed ? "justify-center px-2" : "justify-between px-4"}`}>
        {!collapsed && (
          <Link href="/" aria-label="İş kutusu">
            <Logo />
          </Link>
        )}
        <button
          onClick={toggleCollapsed}
          aria-label={collapsed ? "Menüyü genişlet" : "Menüyü daralt"}
          aria-expanded={!collapsed}
          title={collapsed ? "Menüyü genişlet" : "Menüyü daralt"}
          className="flex size-9 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 hover:text-slate-900"
        >
          {collapsed ? <PanelLeftOpen size={19} /> : <PanelLeftClose size={19} />}
        </button>
      </div>

      {/* Orta: menü grupları */}
      <div className="flex-1 overflow-x-hidden overflow-y-auto px-2.5 py-3">
        {NAV.filter((g) => g.area === "rail").map((g, gi) => {
          const items = visible(g.items, me);
          if (!items.length) return null;
          return (
            <div key={g.title ?? "ana"} className={gi > 0 ? "mt-4" : ""}>
              {/* Grup başlığı yalnız genişçe halde; daralmışken yerine ince bir çizgi */}
              {g.title &&
                (collapsed ? (
                  <span className="mx-auto mb-1 block h-px w-6 bg-slate-200" aria-hidden />
                ) : (
                  <p className="mb-1 px-3 text-[11px] font-semibold tracking-wide text-slate-400 uppercase">{g.title}</p>
                ))}
              <div className="flex flex-col gap-0.5">
                {items.map((i) => (
                  <NavLink key={i.href} item={i} collapsed={collapsed} active={isActivePath(i.href, pathname)} />
                ))}
              </div>
            </div>
          );
        })}
      </div>

      {/* Alt: yardım + hesap */}
      <div className="relative border-t border-slate-100 px-2.5 py-2.5">
        <button
          onClick={() => setHelpOpen((o) => !o)}
          aria-label="Yardım"
          aria-expanded={helpOpen}
          className={`relative flex w-full items-center rounded-xl text-sm transition-colors ${collapsed ? "justify-center p-2.5" : "gap-3 px-3 py-2"} ${
            helpActive ? "bg-slate-100 text-slate-900" : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
          }`}
        >
          <CircleHelp size={19} className="shrink-0" />
          {!collapsed && <span className="flex-1 text-left">Yardım</span>}
          {unseen && <span className={`size-2 rounded-full bg-amber-500 ${collapsed ? "absolute top-2 right-2" : ""}`} aria-label="Okunmamış yenilik var" />}
        </button>
        <Popover open={helpOpen} onClose={closeHelp} className="bottom-14 left-2">
          <p className="px-2.5 pt-1 pb-1.5 text-[11px] font-semibold tracking-wide text-slate-400 uppercase">Yardım</p>
          {help.map((i) => (
            <PopItem key={i.href} item={i} onNavigate={closeHelp} dot={i.badge === "changelog" && unseen} />
          ))}
          <p className="mt-1 border-t border-slate-100 px-2.5 pt-2 text-xs text-slate-500">
            Her yerden arama: <kbd className="rounded border border-slate-200 px-1">Ctrl K</kbd>
          </p>
        </Popover>

        <button
          onClick={() => setAccountOpen((o) => !o)}
          aria-label="Hesap menüsü"
          aria-expanded={accountOpen}
          className={`mt-1 flex w-full items-center rounded-xl transition-colors ${collapsed ? "justify-center p-1.5" : "gap-3 px-2 py-2 hover:bg-slate-100"}`}
        >
          <span
            className={`flex size-9 shrink-0 items-center justify-center rounded-full text-xs font-bold ring-2 ${
              accountActive ? "bg-brand-600 text-white ring-brand-200" : "bg-amber-100 text-amber-900 ring-transparent"
            }`}
          >
            {initialsOf(me?.fullName) || "·"}
          </span>
          {!collapsed && (
            <span className="min-w-0 flex-1 text-left">
              <span className="block truncate text-sm font-semibold text-slate-900">{me?.fullName ?? " "}</span>
              <span className="block truncate text-xs text-slate-500">
                {me?.tenant.name} · {me?.role === "ADMIN" ? "Yönetici" : "Personel"}
              </span>
            </span>
          )}
        </button>
        <Popover open={accountOpen} onClose={closeAccount} className="bottom-2 left-full ml-2">
          <div className="px-2.5 pt-1 pb-2">
            <p className="truncate text-sm font-semibold text-slate-900">{me?.fullName ?? " "}</p>
            <p className="truncate text-xs text-slate-500">
              {me?.tenant.name} · {me?.role === "ADMIN" ? "Yönetici" : "Personel"}
            </p>
          </div>
          <div className="border-t border-slate-100 pt-1">
            {account.map((i) => (
              <PopItem key={i.href} item={i} onNavigate={closeAccount} />
            ))}
          </div>
          <div className="mt-1 border-t border-slate-100 px-1 pt-2 pb-1">
            <ThemeToggle />
          </div>
          <button onClick={onLogout} role="menuitem" className="mt-1 flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm text-red-700 hover:bg-red-50">
            <LogOut size={16} /> Çıkış yap
          </button>
        </Popover>
      </div>
    </nav>
  );
}
