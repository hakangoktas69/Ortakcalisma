import { Logo } from "./Logo";

// Giriş, şifre ve iki adımlı doğrulama ekranlarının kabuğu. Sol panel bir defter sayfasıdır: maddeler çizgili satırlarda,
// onay işaretleri kenar çizgisinin üzerinde (logodaki defter + onay işaretiyle aynı dil). Marka adı: content/brand.ts.

const LINES = [
  { title: "Son günleri kaçırmayın", text: "Beyanname, tebligat ve e-rapor süreleri her sabah iş kutunuzda, en acil olan en üstte." },
  { title: "Kaynağı belli veri", text: "GİB ve SGK verisi sizin açtığınız sayfadan, onayınızla aktarılır." },
  { title: "Şifreniz sizde kalır", text: "Kurum şifreleri varsayılan olarak saklanmaz; her işlem kayıt altında." },
];

/** Logodaki onay işaretinin aynısı */
function Tick() {
  return (
    <svg viewBox="0 0 16 16" className="size-4" aria-hidden="true">
      <path d="M3 8.6l3.1 3.1L13 4.6" fill="none" stroke="oklch(87% 0.15 85)" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/** Giriş ve şifre ekranları: solda marka paneli (büyük ekran), sağda form */
export function AuthShell({ children, wide = false }: { children: React.ReactNode; wide?: boolean }) {
  return (
    <main className="grid min-h-screen grid-cols-1 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
      <section className="ink relative hidden overflow-hidden bg-ink-900 px-12 py-10 text-white lg:flex lg:flex-col xl:px-16">
        <div
          className="pointer-events-none absolute -top-48 -right-48 size-[560px] rounded-full opacity-35 blur-3xl"
          style={{ background: "radial-gradient(circle, oklch(58.5% 0.233 277.117) 0%, transparent 70%)" }}
        />
        <Logo withTagline className="relative" />

        <div className="relative mt-auto max-w-lg">
          <h2 className="text-4xl leading-[1.1] font-extrabold tracking-tight text-balance">Büronuzun bütün son günleri tek defterde.</h2>

          {/* Defter sayfası: kenar çizgisi + çizgili satırlar */}
          <ul className="relative mt-10 border-t border-white/10">
            <span aria-hidden="true" className="absolute inset-y-0 left-6 w-px bg-amber-300/35" />
            {LINES.map((l) => (
              <li key={l.title} className="relative grid grid-cols-[3rem_minmax(0,1fr)] items-start border-b border-white/10 py-4">
                <span className="relative z-10 mt-0.5 flex size-6 items-center justify-center justify-self-center rounded-full bg-ink-900">
                  <Tick />
                </span>
                <span>
                  <span className="block text-[15px] font-semibold">{l.title}</span>
                  <span className="mt-0.5 block text-sm leading-relaxed text-white/60">{l.text}</span>
                </span>
              </li>
            ))}
          </ul>
        </div>

        <p className="relative mt-10 text-xs text-white/45">Bağlantınız şifrelidir. Hesabınızı iki adımlı doğrulamayla koruyabilirsiniz.</p>
      </section>

      <section className="flex flex-col bg-slate-50">
        {/* Telefon ve tablette marka şeridi */}
        <header className="ink relative overflow-hidden bg-ink-900 px-6 py-5 text-white lg:hidden">
          <span aria-hidden="true" className="absolute inset-y-0 left-3 w-px bg-amber-300/35" />
          <Logo withTagline />
        </header>
        <div className="flex flex-1 items-start justify-center px-6 pt-12 pb-6 sm:items-center sm:p-10">
          <div className={`w-full ${wide ? "max-w-xl" : "max-w-sm"}`}>{children}</div>
        </div>
      </section>
    </main>
  );
}
