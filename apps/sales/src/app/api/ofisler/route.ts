import { openOfficeForSale, type OpenOfficeError } from '@eworks/sales';
import { hataGunlugu } from '@/bff/gunluk.ts';
import { konteyner } from '@/bff/konteyner.ts';
import { jsonGovde, satisApiIzni } from '@/bff/oturum.ts';

const HATA: Record<OpenOfficeError, [number, string]> = {
  gecersiz: [422, 'Form bilgilerini kontrol edin.'],
  ofis_var: [409, 'Bu adla bir ofis zaten var.'],
  eposta_kullanimda: [409, 'Bu e-posta adresi başka bir hesapta kullanılıyor.'],
  islem_suruyor: [409, 'Bu ofis için işlem sürüyor; birkaç saniye sonra listeyi kontrol edin.'],
};

const metin = (v: unknown) => (typeof v === 'string' ? v.slice(0, 300) : '');

// Yeni ofis (satis.ofis.create): ofis + yönetici müşavir + deneme lisansı. Geçici parola yalnız bu yanıtta (no-store).
export async function POST(req: Request) {
  const s = await satisApiIzni(req, 'satis.ofis.create', true);
  if (s instanceof Response) return s;
  const g = await jsonGovde<Record<string, unknown>>(req, 4096);
  if (!g) return Response.json({ mesaj: 'İstek geçersiz.' }, { status: 400 });
  try {
    const r = await openOfficeForSale(
      s,
      { officeName: metin(g['officeName']), contactName: metin(g['contactName']), email: metin(g['email']), phone: metin(g['phone']), plan: metin(g['plan']), trialDays: metin(g['trialDays']) },
      konteyner().ofisler,
    );
    if (r.ok) return Response.json({ ofisAdi: metin(g['officeName']).trim(), eposta: r.value.email, geciciParola: r.value.tempPassword }, { status: 201 });
    const [durum, mesaj] = HATA[r.error];
    return Response.json({ mesaj, ...(r.errors ? { alanlar: r.errors.map((a) => ({ alan: a.field, mesaj: a.message })) } : {}) }, { status: durum });
  } catch (e) {
    // Altyapı hatası (veritabanı, kimlik servisi): bilinen durumlara katlanmaz, loglanır
    hataGunlugu('satis.ofis.create', e);
    return Response.json({ mesaj: 'Ofis şu an açılamıyor; biraz sonra tekrar deneyin. Sorun sürerse ofis listesini kontrol edin.' }, { status: 500 });
  }
}
