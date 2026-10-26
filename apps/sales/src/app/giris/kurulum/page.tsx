import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import QRCode from 'qrcode';
import { beginTotpSetup } from '@eworks/sales';
import { konteyner } from '@/bff/konteyner.ts';
import { adimCerezi } from '@/bff/oturum.ts';
import { KurulumFormu } from '@/features/sales/KurulumFormu.tsx';
import { Marka } from '@/shared/ui/Marka.tsx';

// İlk giriş: iki adımlı doğrulama kurulumu (zorunlu). Her açılışta yeni gizli anahtar üretilir; kod onaylanana kadar etkin
// değildir. QR sunucuda veri adresi olarak üretilir (dış istek yok; CSP img-src data:). Anahtar metin olarak da gösterilir.
export default async function Kurulum() {
  const adim = (await cookies()).get(adimCerezi())?.value;
  if (!adim) redirect('/giris');
  const r = await beginTotpSetup(adim, konteyner().giris);
  if (!r.ok) redirect('/giris?hata=sure');
  const qr = await QRCode.toDataURL(r.value.uri, { margin: 1, width: 200, errorCorrectionLevel: 'M' });
  return (
    <main className="giris">
      <div className="giris-kart">
        <Marka />
        <h1>İki adımlı doğrulamayı kurun</h1>
        <p className="alt">Satış portalında iki adımlı doğrulama zorunludur. Telefonunuzdaki doğrulayıcı uygulamayla QR kodu okutun, sonra uygulamanın gösterdiği 6 haneli kodu girin.</p>
        <img className="qr" src={qr} alt="Doğrulayıcı uygulama için QR kod" width={200} height={200} />
        <details>
          <summary>QR okutamıyorum: anahtarı elle gir</summary>
          <p className="anahtar" aria-label="Kurulum anahtarı">
            {r.value.secret}
          </p>
        </details>
        <KurulumFormu />
      </div>
    </main>
  );
}
