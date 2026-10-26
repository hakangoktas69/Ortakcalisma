import { Marka } from './Marka.tsx';

// Satış portalı kabuğu: üst çubuk (marka, gezinme, satışçı adı, çıkış) + içerik. Çıkış CSRF belirteçli form gönderimidir.
export function Kabuk({ ad, csrf, etkin, children }: { ad: string; csrf: string; etkin: 'ofisler' | 'yeni' | 'sifre'; children: React.ReactNode }) {
  const bag = (href: string, ad_: string, k: typeof etkin) => (
    <a href={href} {...(etkin === k ? { 'aria-current': 'page' as const } : {})}>
      {ad_}
    </a>
  );
  return (
    <>
      <header className="ust">
        <div className="ust-ic">
          <Marka />
          <nav aria-label="Satış menüsü">
            {bag('/', 'Ofisler', 'ofisler')}
            {bag('/yeni', 'Yeni ofis', 'yeni')}
            {bag('/sifre', 'Parola ve güvenlik', 'sifre')}
          </nav>
          <div className="kullanici">
            <span>{ad}</span>
            <form method="post" action="/api/oturum/cikis">
              <input type="hidden" name="csrf" value={csrf} />
              <button type="submit" className="dugme ikincil">
                Çıkış
              </button>
            </form>
          </div>
        </div>
      </header>
      <main className="icerik">{children}</main>
    </>
  );
}

export function Yasak() {
  return (
    <section className="kart">
      <h1>Yetkiniz yok</h1>
      <p className="alt">Bu sayfa satış ekibinin yetkisinde değil.</p>
      <a href="/">Ofis listesine dön</a>
    </section>
  );
}
