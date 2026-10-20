"use client";

import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { ChevronDown, CircleHelp, LogOut, Menu, Search, X } from "lucide-react";
import { api, getToken, setToken, type Me } from "@/lib/api";
import NotificationBell from "@/components/NotificationBell";
import WhatsappStatus from "@/components/WhatsappStatus";
import { NAV, isActivePath, type NavGroup, type NavItem } from "@/components/shell/nav";
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
      if (ref.current && !ref.current.parentElement?.contains(e.target as Node)) onClose();
    };
    const onEsc = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onEsc);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onEsc);
    };
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div ref={ref} role="menu" className={`absolute z-40 rounded-xl border border-slate-200 bg-white p-2 text-slate-800 shadow-xl ${className}`}>
      {children}
    </div>
  );
}

function MenuLink({ item, onNavigate, dot, active }: { item: NavItem; onNavigate: () => void; dot?: boolean; active?: boolean }) {
  const Icon = item.icon;
  return (
    <Link
      href={item.href}
      onClick={onNavigate}
      role="menuitem"
      className={`flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm ${active ? "bg-brand-50 font-semibold text-brand-800" : "text-slate-700 hover:bg-slate-100"}`}
    >
      <Icon size={16} className={active ? "text-brand-600" : "text-slate-500"} />
      <span className="flex-1">{item.label}</span>
      {dot && <span className="size-2 rounded-full bg-amber-500" aria-label="Okunmamış yenilik var" />}
    </Link>
  );
}

// Üst çubuk renkli zeminde; koyu temada ters dönmemesi için renkler sabit (tema değişkeni değil)
const barLink = "rounded-lg px-3 py-1.5 text-sm font-medium transition-colors";
const barIdle = "text-[#fff]/80 hover:bg-[#fff]/10 hover:text-[#fff]";
const barActive = "bg-[#fff]/20 text-[#fff]";

/** Açılır grup (Beyan, SGK, Muhasebe) */
function GroupMenu({ group, me, pathname }: { group: NavGroup; me: Me | null; pathname: string }) {
  const [open, setOpen] = useState(false);
  const close = useCallback(() => setOpen(false), []);
  const items = visible(group.items, me);
  const active = items.some((i) => isActivePath(i.href, pathname));
  return (
    <div className="relative">
      <button onClick={() => setOpen((o) => !o)} aria-expanded={open} className={`${barLink} flex items-center gap-1 ${active ? barActive : barIdle}`}>
        {group.menu}
        <ChevronDown size={14} className={`transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      <Popover open={open} onClose={close} className="top-full left-0 mt-2 w-56">
        {items.map((i) => (
          <MenuLink key={i.href} item={i} onNavigate={close} active={isActivePath(i.href, pathname)} />
        ))}
      </Popover>
    </div>
  );
}

function TopBar({ me, onLogout, onSearch, onMenu }: { me: Me | null; onLogout: () => void; onSearch: () => void; onMenu: () => void }) {
  const pathname = usePathname();
  const unseen = useHasUnseenChanges();
  const [helpOpen, setHelpOpen] = useState(false);
  const [accountOpen, setAccountOpen] = useState(false);
  const closeHelp = useCallback(() => setHelpOpen(false), []);
  const closeAccount = useCallback(() => setAccountOpen(false), []);
  const help = NAV.filter((g) => g.area === "help").flatMap((g) => g.items);
  const account = visible(NAV.filter((g) => g.area === "account").flatMap((g) => g.items), me);

  return (
    <header className="sticky top-0 z-30 bg-[linear-gradient(100deg,#3730a3_0%,#4f46e5_42%,#0ea5e9_100%)] text-[#fff] shadow-sm">
      <div className="mx-auto flex h-14 max-w-[1440px] items-center gap-2 px-4 md:px-8">
        <button onClick={onMenu} className="rounded-md p-1.5 text-[#fff]/90 hover:bg-[#fff]/10 lg:hidden" aria-label="Menüyü aç">
          <Menu size={20} />
        </button>
        <Link href="/" className="mr-3 shrink-0 rounded-xl" aria-label="İş kutusu">
          <span className="hidden sm:block">
            <Logo />
          </span>
          <span className="sm:hidden">
            <Logo withText={false} />
          </span>
        </Link>

        <nav aria-label="Ana menü" className="hidden items-center gap-0.5 lg:flex">
          {NAV.filter((g) => g.area === "rail").map((g) =>
            g.menu ? (
              <GroupMenu key={g.menu} group={g} me={me} pathname={pathname} />
            ) : (
              visible(g.items, me).map((i) => (
                <Link key={i.href} href={i.href} aria-current={isActivePath(i.href, pathname) ? "page" : undefined} className={`${barLink} ${isActivePath(i.href, pathname) ? barActive : barIdle}`}>
                  {i.label}
                </Link>
              ))
            ),
          )}
        </nav>

        <div className="ml-auto flex items-center gap-2">
          <button onClick={onSearch} className="flex h-9 items-center gap-2 rounded-lg bg-[#fff]/15 px-3 text-sm text-[#fff]/90 hover:bg-[#fff]/25" aria-label="Ara">
            <Search size={15} />
            <span className="hidden xl:inline">Ara</span>
            <kbd className="hidden rounded bg-[#fff]/20 px-1.5 text-[10px] font-medium md:inline">Ctrl K</kbd>
          </button>

          <div className="relative">
            <button
              onClick={() => setHelpOpen((o) => !o)}
              aria-label="Yardım"
              aria-expanded={helpOpen}
              className="relative flex size-9 items-center justify-center rounded-lg text-[#fff]/90 hover:bg-[#fff]/10"
            >
              <CircleHelp size={19} />
              {unseen && <span className="absolute top-1.5 right-1.5 size-2 rounded-full bg-[#fcd34d]" aria-label="Okunmamış yenilik var" />}
            </button>
            <Popover open={helpOpen} onClose={closeHelp} className="top-full right-0 mt-2 w-60">
              {help.map((i) => (
                <MenuLink key={i.href} item={i} onNavigate={closeHelp} dot={i.badge === "changelog" && unseen} active={isActivePath(i.href, pathname)} />
              ))}
              <p className="mt-1 border-t border-slate-100 px-2.5 pt-2 text-xs text-slate-500">
                Her yerden arama: <kbd className="rounded border border-slate-200 px-1">Ctrl K</kbd>
              </p>
            </Popover>
          </div>

          <div className="rounded-full bg-white p-0.5">
            <NotificationBell />
          </div>

          <div className="relative">
            <button
              onClick={() => setAccountOpen((o) => !o)}
              aria-label="Hesap menüsü"
              aria-expanded={accountOpen}
              className="flex size-9 items-center justify-center rounded-full bg-[#fcd34d] text-xs font-bold text-[#1e1b4b] ring-2 ring-[#fff]/40 hover:ring-[#fff]/70"
            >
              {initialsOf(me?.fullName) || "·"}
            </button>
            <Popover open={accountOpen} onClose={closeAccount} className="top-full right-0 mt-2 w-72">
              <div className="px-2.5 pt-1 pb-2">
                <p className="truncate text-sm font-semibold text-slate-900">{me?.fullName ?? " "}</p>
                <p className="truncate text-xs text-slate-500">
                  {me?.tenant.name} · {me?.role === "ADMIN" ? "Yönetici" : "Personel"}
                </p>
                <div className="mt-2">
                  <WhatsappStatus />
                </div>
              </div>
              <div className="border-t border-slate-100 pt-1">
                {account.map((i) => (
                  <MenuLink key={i.href} item={i} onNavigate={closeAccount} active={isActivePath(i.href, pathname)} />
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
        </div>
      </div>
    </header>
  );
}

/** Mobil ve dar ekran: tüm menü adlarıyla birlikte açılır çekmece */
function Drawer({ me, onClose, onLogout }: { me: Me | null; onClose: () => void; onLogout: () => void }) {
  const pathname = usePathname();
  const unseen = useHasUnseenChanges();
  return (
    <div className="fixed inset-0 z-40 lg:hidden" role="dialog" aria-label="Menü">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="absolute inset-y-0 left-0 flex w-72 max-w-[85vw] flex-col bg-white shadow-xl">
        <div className="flex items-center justify-between bg-[linear-gradient(100deg,#3730a3_0%,#4f46e5_60%,#0ea5e9_100%)] px-4 py-3.5 text-[#fff]">
          <Logo />
          <button onClick={onClose} className="rounded-md p-1.5 text-[#fff]/80 hover:bg-[#fff]/10" aria-label="Menüyü kapat">
            <X size={18} />
          </button>
        </div>
        <div className="flex-1 space-y-4 overflow-y-auto px-3 py-4">
          {NAV.map((g) => {
            const items = visible(g.items, me);
            if (!items.length) return null;
            return (
              <div key={g.title ?? "ana"}>
                {g.title && <p className="mb-1 px-2.5 text-[11px] font-semibold tracking-wide text-slate-400 uppercase">{g.title}</p>}
                {items.map((i) => (
                  <MenuLink key={i.href} item={i} onNavigate={onClose} dot={i.badge === "changelog" && unseen} active={isActivePath(i.href, pathname)} />
                ))}
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

  return (
    <div className="flex min-h-screen flex-col">
      <TopBar me={me} onLogout={logout} onSearch={() => setPaletteOpen(true)} onMenu={() => setDrawerOpen(true)} />
      {drawerOpen && <Drawer me={me} onClose={() => setDrawerOpen(false)} onLogout={logout} />}
      <main className="mx-auto w-full max-w-[1440px] flex-1 p-4 md:px-8 md:py-6">
        {/* Görünümler veriyi istemcide çeker; prerender'da ertelenen kısım (ör. new Date()) bu sınırda kalır */}
        <Suspense fallback={null}>{children}</Suspense>
      </main>
      {paletteOpen && <CommandPalette open onClose={() => setPaletteOpen(false)} isAdmin={me?.role === "ADMIN"} />}
    </div>
  );
}
