"use client";

import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { CircleHelp, LogOut, Menu, Search, X } from "lucide-react";
import { api, getToken, setToken, type Me } from "@/lib/api";
import NotificationBell from "@/components/NotificationBell";
import WhatsappStatus from "@/components/WhatsappStatus";
import { NAV, isActivePath, type NavItem } from "@/components/shell/nav";
import { Logo } from "@/components/shell/Logo";
import { ThemeToggle } from "@/components/shell/ThemeToggle";
import { CommandPalette } from "@/components/shell/CommandPalette";
import { useHasUnseenChanges } from "@/components/shell/changelog-seen";

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
    <div ref={ref} role="menu" className={`absolute z-40 w-64 rounded-xl border border-slate-200 bg-white p-2 shadow-xl ${className}`}>
      {children}
    </div>
  );
}

function MenuLink({ item, onNavigate, dot }: { item: NavItem; onNavigate: () => void; dot?: boolean }) {
  const Icon = item.icon;
  return (
    <Link href={item.href} onClick={onNavigate} role="menuitem" className="flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm text-slate-700 hover:bg-slate-100">
      <Icon size={16} className="text-slate-500" />
      <span className="flex-1">{item.label}</span>
      {dot && <span className="size-2 rounded-full bg-amber-500" aria-label="Okunmamış yenilik var" />}
    </Link>
  );
}

/** Masaüstü: sadece ikonlardan oluşan dar şerit; ad, üzerine gelince yanında çıkar */
function Rail({ me, onLogout }: { me: Me | null; onLogout: () => void }) {
  const pathname = usePathname();
  const unseen = useHasUnseenChanges();
  const [helpOpen, setHelpOpen] = useState(false);
  const [accountOpen, setAccountOpen] = useState(false);
  const closeHelp = useCallback(() => setHelpOpen(false), []);
  const closeAccount = useCallback(() => setAccountOpen(false), []);
  const help = NAV.filter((g) => g.area === "help").flatMap((g) => g.items);
  const account = visible(NAV.filter((g) => g.area === "account").flatMap((g) => g.items), me);
  const accountActive = account.some((i) => isActivePath(i.href, pathname));
  const helpActive = help.some((i) => isActivePath(i.href, pathname));

  return (
    <nav aria-label="Ana menü" className="flex h-full flex-col items-center border-r border-slate-200 bg-white py-3">
      <Link href="/" aria-label="İş kutusu" className="mb-3">
        <Logo withText={false} />
      </Link>
      <div className="flex flex-1 flex-col items-center gap-0.5 px-2">
        {NAV.filter((g) => g.area === "rail").map((g, gi) => (
          <div key={g.title ?? "ana"} className="flex flex-col items-center gap-0.5">
            {gi > 0 && <span className="my-1.5 h-px w-6 bg-slate-200" aria-hidden />}
            {visible(g.items, me).map(({ href, label, icon: Icon }) => {
              const active = isActivePath(href, pathname);
              return (
                <Link
                  key={href}
                  href={href}
                  aria-label={label}
                  aria-current={active ? "page" : undefined}
                  className={`group relative flex size-[38px] items-center justify-center rounded-xl transition-colors ${
                    active ? "bg-brand-600 text-white shadow-sm" : "text-slate-500 hover:bg-slate-100 hover:text-slate-900"
                  }`}
                >
                  <Icon size={19} />
                  <span className="pointer-events-none absolute left-full z-40 ml-3 hidden rounded-md bg-slate-900 px-2 py-1 text-xs font-medium whitespace-nowrap text-white shadow group-hover:block group-focus-visible:block">
                    {label}
                  </span>
                </Link>
              );
            })}
          </div>
        ))}
      </div>

      <div className="relative mt-2 flex flex-col items-center gap-2 px-2">
        <button
          onClick={() => setHelpOpen((o) => !o)}
          aria-label="Yardım"
          aria-expanded={helpOpen}
          className={`relative flex size-10 items-center justify-center rounded-xl ${helpActive ? "bg-slate-100 text-slate-900" : "text-slate-500 hover:bg-slate-100 hover:text-slate-900"}`}
        >
          <CircleHelp size={19} />
          {unseen && <span className="absolute top-2 right-2 size-2 rounded-full bg-amber-500 ring-2 ring-white" aria-label="Okunmamış yenilik var" />}
        </button>
        <Popover open={helpOpen} onClose={closeHelp} className="bottom-12 left-full ml-2">
          <p className="px-2.5 pt-1 pb-1.5 text-[11px] font-semibold tracking-wide text-slate-400 uppercase">Yardım</p>
          {help.map((i) => (
            <MenuLink key={i.href} item={i} onNavigate={closeHelp} dot={i.badge === "changelog" && unseen} />
          ))}
          <p className="mt-1 border-t border-slate-100 px-2.5 pt-2 text-xs text-slate-500">
            Her yerden arama: <kbd className="rounded border border-slate-200 px-1">Ctrl K</kbd>
          </p>
        </Popover>

        <button
          onClick={() => setAccountOpen((o) => !o)}
          aria-label="Hesap menüsü"
          aria-expanded={accountOpen}
          className={`flex size-10 items-center justify-center rounded-full text-xs font-bold ring-2 ${
            accountActive ? "bg-brand-600 text-white ring-brand-200" : "bg-amber-100 text-amber-900 ring-transparent hover:ring-amber-200"
          }`}
        >
          {initialsOf(me?.fullName) || "·"}
        </button>
        <Popover open={accountOpen} onClose={closeAccount} className="bottom-0 left-full ml-2">
          <div className="px-2.5 pt-1 pb-2">
            <p className="truncate text-sm font-semibold text-slate-900">{me?.fullName ?? " "}</p>
            <p className="truncate text-xs text-slate-500">
              {me?.tenant.name} · {me?.role === "ADMIN" ? "Yönetici" : "Personel"}
            </p>
          </div>
          <div className="border-t border-slate-100 pt-1">
            {account.map((i) => (
              <MenuLink key={i.href} item={i} onNavigate={closeAccount} />
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

/** Mobil: tüm menü adlarıyla birlikte açılır çekmece */
function Drawer({ me, onClose, onLogout }: { me: Me | null; onClose: () => void; onLogout: () => void }) {
  const pathname = usePathname();
  const unseen = useHasUnseenChanges();
  return (
    <div className="fixed inset-0 z-40 md:hidden" role="dialog" aria-label="Menü">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="absolute inset-y-0 left-0 flex w-72 max-w-[85vw] flex-col bg-white shadow-xl">
        <div className="flex items-center justify-between px-4 py-4">
          <Logo />
          <button onClick={onClose} className="rounded-md p-1.5 text-slate-500 hover:bg-slate-100" aria-label="Menüyü kapat">
            <X size={18} />
          </button>
        </div>
        <div className="flex-1 space-y-4 overflow-y-auto px-3 pb-4">
          {NAV.map((g) => {
            const items = visible(g.items, me);
            if (!items.length) return null;
            return (
              <div key={g.title ?? "ana"}>
                {g.title && <p className="mb-1 px-2.5 text-[11px] font-semibold tracking-wide text-slate-400 uppercase">{g.title}</p>}
                {items.map((i) => {
                  const Icon = i.icon;
                  const active = isActivePath(i.href, pathname);
                  return (
                    <Link
                      key={i.href}
                      href={i.href}
                      onClick={onClose}
                      className={`flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm ${active ? "bg-brand-50 font-semibold text-brand-800" : "text-slate-700 hover:bg-slate-100"}`}
                    >
                      <Icon size={17} className={active ? "text-brand-600" : "text-slate-500"} />
                      <span className="flex-1">{i.label}</span>
                      {i.badge === "changelog" && unseen && <span className="size-2 rounded-full bg-amber-500" aria-label="Okunmamış yenilik var" />}
                    </Link>
                  );
                })}
              </div>
            );
          })}
        </div>
        <div className="space-y-2 border-t border-slate-200 p-3">
          <ThemeToggle />
          <button onClick={onLogout} className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm text-red-700 hover:bg-red-50">
            <LogOut size={16} /> Çıkış yap
          </button>
        </div>
      </div>
    </div>
  );
}

export default function PanelLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [me, setMe] = useState<Me | null>(null);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);

  useEffect(() => {
    if (!getToken()) {
      router.replace("/login");
      return;
    }
    api<Me>("/auth/me")
      .then((m) => {
        setMe(m);
        // Büroda 2FA zorunlu ve kullanıcı kurmamışsa önce kurulum
        if (m.twoFactorRequired && !m.twoFactorEnabled) router.replace("/iki-adim");
      })
      .catch(() => {});
  }, [router]);

  // Ctrl/Cmd + K her yerden, "/" yazı alanı dışındayken komut paletini açar
  const onKey = useCallback((e: KeyboardEvent) => {
    const typing = e.target instanceof HTMLElement && (e.target.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName));
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
      e.preventDefault();
      setPaletteOpen((o) => !o);
    } else if (e.key === "/" && !typing) {
      e.preventDefault();
      setPaletteOpen(true);
    }
  }, []);
  useEffect(() => {
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onKey]);

  function logout() {
    setToken(null);
    router.replace("/login");
  }

  const current = NAV.flatMap((g) => g.items).find((i) => isActivePath(i.href, pathname));

  return (
    <div className="flex min-h-screen">
      <aside className="sticky top-0 hidden h-screen w-[68px] shrink-0 md:block">
        <Rail me={me} onLogout={logout} />
      </aside>

      {drawerOpen && <Drawer me={me} onClose={() => setDrawerOpen(false)} onLogout={logout} />}

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-20 flex h-14 items-center gap-3 border-b border-slate-200 bg-white/90 px-4 backdrop-blur md:px-6">
          <button onClick={() => setDrawerOpen(true)} className="rounded-md p-1.5 text-slate-600 hover:bg-slate-100 md:hidden" aria-label="Menüyü aç">
            <Menu size={20} />
          </button>
          <p className="min-w-0 truncate text-[15px] font-semibold text-slate-900 md:w-44">{current?.label}</p>
          <button
            onClick={() => setPaletteOpen(true)}
            className="ml-auto flex h-9 min-w-0 items-center gap-2 rounded-lg bg-slate-100 px-3 text-sm text-slate-500 hover:bg-slate-200/70 md:ml-0 md:w-full md:max-w-md"
            aria-label="Ara"
          >
            <Search size={15} />
            <span className="hidden flex-1 truncate text-left sm:block">Mükellef, sayfa veya işlem ara…</span>
            <kbd className="hidden rounded border border-slate-300 bg-white px-1.5 text-[10px] font-medium text-slate-500 md:inline">Ctrl K</kbd>
          </button>
          <div className="flex items-center gap-2 md:ml-auto">
            <span className="hidden sm:block">
              <WhatsappStatus />
            </span>
            <NotificationBell />
          </div>
        </header>
        <main className="w-full flex-1 p-4 md:px-6 md:py-5">
          {/* Görünümler veriyi istemcide çeker; prerender'da ertelenen kısım (ör. new Date()) bu sınırda kalır */}
          <Suspense fallback={null}>{children}</Suspense>
        </main>
      </div>

      {paletteOpen && <CommandPalette open onClose={() => setPaletteOpen(false)} isAdmin={me?.role === "ADMIN"} />}
    </div>
  );
}
