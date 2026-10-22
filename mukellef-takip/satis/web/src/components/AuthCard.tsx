import { Logo } from "./Logo";

/** Giriş ve şifre ekranlarının kabuğu: turuncu şerit + ortalanmış kart. */
export function AuthCard({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col">
      <div className="h-1.5 bg-[linear-gradient(100deg,#9a3412_0%,#ea580c_45%,#f59e0b_100%)]" />
      <main className="flex flex-1 items-start justify-center px-4 py-10 sm:items-center">
        <div className="w-full max-w-md">
          <div className="mb-6 flex justify-center">
            <Logo dark />
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
            <h1 className="text-xl font-bold text-slate-900">{title}</h1>
            {subtitle && <p className="mt-1 mb-5 text-sm text-slate-600">{subtitle}</p>}
            {children}
          </div>
        </div>
      </main>
    </div>
  );
}
