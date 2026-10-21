import { Logo } from "./Logo";

// Giriş, şifre ve iki adımlı doğrulama ekranlarının kabuğu. Bütün sayfa bir defter kağıdıdır: 32 piksel aralıklı
// satır çizgileri ve solda kırmızı kenar çizgisi. Yazılar satırlara oturur (yükseklik ve boşluklar 32'nin katı),
// form defterin üstüne konmuş bir kart gibi durur. Renkler tema değişkenlerinden: koyu temada da kendiliğinden döner.

const LINES = [
  { title: "Son günleri kaçırmayın", text: "Beyanname, tebligat ve e-rapor süreleri her sabah iş kutunuzda." },
  { title: "Kaynağı belli veri", text: "GİB ve SGK verisi sizin açtığınız sayfadan, onayınızla aktarılır." },
  { title: "Şifreniz sizde kalır", text: "Kurum şifreleri varsayılan olarak saklanmaz; her işlem kayıt altında." },
];

/** Logodaki onay işaretinin çizgisi */
function Tick() {
  return (
    <svg viewBox="0 0 16 16" className="size-4 text-brand-600" aria-hidden="true">
      <path d="M3 8.6l3.1 3.1L13 4.6" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

const ruled = {
  backgroundImage: "repeating-linear-gradient(to bottom, transparent 0 31px, var(--color-slate-200) 31px 32px)",
};

/** Giriş ve şifre ekranları: defter sayfası üzerinde solda kısa tanıtım (büyük ekran), sağda form kartı */
export function AuthShell({ children, wide = false }: { children: React.ReactNode; wide?: boolean }) {
  return (
    <main className="relative min-h-screen bg-slate-50" style={ruled}>
      {/* Defterin kırmızı kenar çizgisi */}
      <span aria-hidden="true" className="pointer-events-none absolute inset-y-0 left-4 w-px bg-red-300 sm:left-10 lg:left-16" />

      <div className="relative mx-auto flex min-h-screen max-w-6xl flex-col pt-8 pr-6 pb-16 pl-8 sm:pl-16 lg:pr-10 lg:pl-28">
        <header className="flex h-16 items-center">
          <Logo withTagline className="text-slate-900" />
        </header>

        <div className="mt-8 grid flex-1 grid-cols-1 items-start gap-x-16 gap-y-8 lg:mt-16 lg:grid-cols-[minmax(0,1fr)_minmax(0,auto)]">
          <section className="hidden max-w-xl lg:block">
            <h2 className="text-[2.75rem] leading-[64px] font-extrabold tracking-tight text-slate-900">Büronuzun bütün son günleri tek defterde.</h2>
            <ul className="mt-8">
              {LINES.map((l) => (
                <li key={l.title} className="grid grid-cols-[1.75rem_minmax(0,1fr)] text-[15px] leading-8 [&+li]:mt-8">
                  <span className="flex h-8 items-center">
                    <Tick />
                  </span>
                  <span>
                    <span className="block font-semibold text-slate-900">{l.title}</span>
                    <span className="block text-slate-600">{l.text}</span>
                  </span>
                </li>
              ))}
            </ul>
          </section>

          {/* Form kartı: defterin üstüne konmuş kağıt */}
          <div
            className={`w-full justify-self-center rounded-2xl border border-slate-200 bg-white p-6 shadow-[0_1px_0_var(--color-slate-200),0_12px_32px_-12px_rgb(15_23_42/0.18)] sm:p-8 lg:justify-self-end ${
              wide ? "max-w-xl" : "max-w-md"
            }`}
          >
            {children}
          </div>
        </div>

        <p className="mt-8 text-xs leading-8 text-slate-500">Bağlantınız şifrelidir. Hesabınızı iki adımlı doğrulamayla koruyabilirsiniz.</p>
      </div>
    </main>
  );
}
