import { redirect } from 'next/navigation';
import QRCode from 'qrcode';
import { beginTotpEnrollment } from '@eworks/sales';
import { konteyner } from '@/bff/konteyner.ts';
import { satisSayfaIzni } from '@/bff/oturum.ts';
import { KurulumFormu } from '@/features/sales/KurulumFormu.tsx';
import { Kabuk } from '@/shared/ui/Kabuk.tsx';

// İki adımlı doğrulamayı açma (satis.oturum.mfa; D41: isteğe bağlı). Her açılışta yeni gizli anahtar; kod onaylanana kadar
// etkin değildir. QR sunucuda veri adresi olarak üretilir (dış istek yok; CSP img-src data:). Anahtar metin olarak da gösterilir.
export default async function IkiAdimAc() {
  const { oturum } = await satisSayfaIzni('satis.oturum.mfa');
  const r = await beginTotpEnrollment(oturum, konteyner().giris);
  if (!r.ok) redirect('/sifre');
  const qr = await QRCode.toDataURL(r.value.uri, { margin: 1, width: 200, errorCorrectionLevel: 'M' });
  return (
    <Kabuk ad={oturum.fullName} csrf={oturum.csrf} etkin="sifre">
      <section className="kart form">
        <h1>İki adımlı doğrulamayı açın</h1>
        <p className="alt">Telefonunuzdaki doğrulayıcı uygulamayla (Google Authenticator, Microsoft Authenticator vb.) QR kodu okutun, sonra parolanızı ve uygulamanın gösterdiği 6 haneli kodu girin. Açınca diğer cihazlardaki oturumlarınız kapanır. Açıkken girişte resimli güvenlik kodu istenmez.</p>
        <img className="qr" src={qr} alt="Doğrulayıcı uygulama için QR kod" width={200} height={200} />
        <details>
          <summary>QR okutamıyorum: anahtarı elle gir</summary>
          <p className="anahtar" aria-label="Kurulum anahtarı">
            {r.value.secret}
          </p>
        </details>
        <KurulumFormu csrf={oturum.csrf} />
        <a href="/sifre">Vazgeç</a>
      </section>
    </Kabuk>
  );
}
