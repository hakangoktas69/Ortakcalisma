"use client";

import { Suspense, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { LogOut, Menu, Search, X } from "lucide-react";
import { api, getToken, setToken, type Me } from "@/lib/api";
import NotificationBell from "@/components/NotificationBell";
import WhatsappStatus from "@/components/WhatsappStatus";
import { NAV, isActivePath, type NavItem } from "@/components/shell/nav";
import { Logo } from "@/components/shell/Logo";
import { ThemeToggle } from "@/components/shell/ThemeToggle";
import { Sidebar } from "@/components/shell/Sidebar";
import { CommandPalette } from "@/components/shell/CommandPalette";
import { useHasUnseenChanges } from "@/components/shell/changelog-seen";

const visible = (items: NavItem[], me: Me | null) => items.filter((i) => !i.adminOnly || me?.role === "ADMIN");

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
      {/* sticky kendi yığın bağlamını kurar: menü açılır pencereleri içeriğin üstünde kalsın diye z-30. Genişlik Sidebar'da (açılır/kapanır). */}
      <aside className="sticky top-0 z-30 hidden h-screen shrink-0 md:block">
        <Sidebar me={me} onLogout={logout} />
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
