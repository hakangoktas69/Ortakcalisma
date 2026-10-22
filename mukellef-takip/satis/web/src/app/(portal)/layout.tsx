"use client";

import { KeyRound, LogOut } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Logo } from "@/components/Logo";
import { api, type Me } from "@/lib/api";

const NAV = [
  { href: "/", label: "Bürolar" },
  { href: "/yeni", label: "Yeni müşavir" },
  { href: "/ekip", label: "Satış ekibi" },
];

const isActive = (href: string, path: string) => (href === "/" ? path === "/" || path.startsWith("/buro") : path.startsWith(href));

export default function PortalLayout({ children }: LayoutProps<"/">) {
  const router = useRouter();
  const pathname = usePathname();
  const [me, setMe] = useState<Me | null>(null);

  useEffect(() => {
    // Oturum yoksa istemci giriş ekranına, geçici şifreyle girildiyse şifre ekranına yönlendirir (lib/api)
    api<Me>("/auth/me").then((m) => {
      if (m.mustChangePassword) router.replace("/sifre");
      else setMe(m);
    }, () => undefined);
  }, [router]);

  const logout = async () => {
    await api("/auth/logout", { body: {} }).catch(() => undefined);
    router.replace("/giris");
  };

  return (
    <div className="flex min-h-screen flex-col">
      <header className="sticky top-0 z-30 bg-[linear-gradient(100deg,#9a3412_0%,#ea580c_45%,#f59e0b_100%)] text-white shadow-sm">
        <div className="mx-auto flex h-14 max-w-[1280px] items-center gap-3 px-4 md:px-8">
          <Link href="/" aria-label="Bürolar" className="shrink-0">
            <Logo />
          </Link>
          <nav aria-label="Ana menü" className="ml-4 hidden items-center gap-1 md:flex">
            {NAV.map((n) => (
              <Link
                key={n.href}
                href={n.href}
                aria-current={isActive(n.href, pathname) ? "page" : undefined}
                className={`rounded-lg px-3 py-1.5 text-sm font-semibold ${isActive(n.href, pathname) ? "bg-white text-brand-800" : "text-white/90 hover:bg-white/15"}`}
              >
                {n.label}
              </Link>
            ))}
          </nav>
          <div className="ml-auto flex min-w-0 items-center gap-1">
            {me && <span className="hidden truncate text-sm font-medium text-white/90 lg:inline">{me.fullName}</span>}
            <Link href="/sifre" className="rounded-lg p-2 text-white/90 hover:bg-white/15" aria-label="Şifre değiştir" title="Şifre değiştir">
              <KeyRound size={18} />
            </Link>
            <button onClick={logout} className="rounded-lg p-2 text-white/90 hover:bg-white/15" aria-label="Çıkış yap" title="Çıkış yap">
              <LogOut size={18} />
            </button>
          </div>
        </div>
        {/* Telefonda menü başlığın altında yatay şerit */}
        <nav aria-label="Ana menü (telefon)" className="flex gap-1 overflow-x-auto px-4 pb-2 md:hidden">
          {NAV.map((n) => (
            <Link
              key={n.href}
              href={n.href}
              aria-current={isActive(n.href, pathname) ? "page" : undefined}
              className={`shrink-0 rounded-lg px-3 py-1.5 text-sm font-semibold ${isActive(n.href, pathname) ? "bg-white text-brand-800" : "bg-white/15 text-white"}`}
            >
              {n.label}
            </Link>
          ))}
        </nav>
      </header>
      <main className="mx-auto w-full max-w-[1280px] flex-1 p-4 md:px-8 md:py-6">{me ? children : null}</main>
    </div>
  );
}
