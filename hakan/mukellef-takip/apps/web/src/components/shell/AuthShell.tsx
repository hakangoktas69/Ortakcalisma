import { CalendarCheck2, FileSearch, ShieldCheck } from "lucide-react";
import { Logo } from "./Logo";

const POINTS = [
  { icon: CalendarCheck2, title: "Son günleri kaçırmayın", text: "Beyanname, tebligat ve e-rapor süreleri tek ekranda, en acil olan üstte." },
  { icon: FileSearch, title: "Kaynağı belli veri", text: "GİB ve SGK verisi sizin açtığınız sayfadan, onayınızla aktarılır." },
  { icon: ShieldCheck, title: "Şifreniz sizde kalır", text: "Kurum şifreleri varsayılan olarak saklanmaz; her işlem kayıt altında." },
];

/** Giriş ve şifre ekranları: solda marka paneli, sağda form */
export function AuthShell({ children, wide = false }: { children: React.ReactNode; wide?: boolean }) {
  return (
    <main className="grid min-h-screen lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
      <section className="ink relative hidden overflow-hidden bg-ink-900 p-12 text-white lg:flex lg:flex-col">
        <div
          className="pointer-events-none absolute -top-40 -right-40 size-[520px] rounded-full opacity-40 blur-3xl"
          style={{ background: "radial-gradient(circle, oklch(58.5% 0.233 277.117) 0%, transparent 70%)" }}
        />
        <Logo />
        <div className="relative mt-auto max-w-md">
          <h2 className="text-3xl leading-tight font-extrabold tracking-tight">
            Mali müşavirlik büronuzun <span className="text-amber-300">günlük işleri</span>, tek yerde.
          </h2>
          <ul className="mt-8 space-y-5">
            {POINTS.map(({ icon: Icon, title, text }) => (
              <li key={title} className="flex gap-3">
                <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-white/10 text-amber-300">
                  <Icon size={18} />
                </span>
                <span>
                  <span className="block text-sm font-semibold">{title}</span>
                  <span className="block text-sm text-white/60">{text}</span>
                </span>
              </li>
            ))}
          </ul>
        </div>
        <p className="relative mt-12 text-xs text-white/40">Mükellef Takip · mali müşavirler için</p>
      </section>
      <section className="flex items-center justify-center bg-slate-50 p-6">
        <div className={`w-full ${wide ? "max-w-xl" : "max-w-sm"}`}>
          <div className="mb-8 lg:hidden">
            <span className="ink inline-flex rounded-xl bg-ink-900 px-3 py-2 text-white">
              <Logo />
            </span>
          </div>
          {children}
        </div>
      </section>
    </main>
  );
}
