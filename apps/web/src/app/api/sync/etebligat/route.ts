import { accountStatuses, hasActiveConsent } from '@eworks/credentials';
import { getFirm } from '@eworks/portfolio';
import { requestJob } from '@eworks/sync';
import { ISTEK_HATASI } from '@/bff/isler.ts';
import { konteyner } from '@/bff/konteyner.ts';
import { apiIzni, baglam, jsonGovde } from '@/bff/oturum.ts';

// "e-Tebligat'ı GİB'den güncelle" (tebligat.liste.sync; D45, D46): firmanın kendi GİB hesabıyla, yalnız etkin mükellef onayı
// varken iş açılır (işçi başlarken veritabanı yeniden denetler). Liste okunur, belge açılmaz.
export async function POST(req: Request) {
  const s = await apiIzni(req, 'tebligat.liste.sync', true);
  if (s instanceof Response) return s;
  const g = await jsonGovde<{ firmaId?: unknown }>(req, 256);
  if (!g || typeof g.firmaId !== 'string' || !/^[0-9a-f-]{36}$/.test(g.firmaId)) return Response.json({ mesaj: 'İstek geçersiz.' }, { status: 400 });
  const ctx = baglam(s);
  const k = konteyner();
  // Başka ofisin ya da kapsam dışındaki firma RLS ile görünmez → 404
  const firma = await getFirm(ctx, g.firmaId, k.firmalar);
  if (!firma || firma.archivedAt) return Response.json({ mesaj: 'Firma bulunamadı.' }, { status: 404 });
  if (!(await hasActiveConsent(ctx, firma.id, k.onaylar))) {
    return Response.json({ mesaj: 'Bu firmanın kurum hesabını kullanmak için önce firma kartında mükellef onayını kaydedin.' }, { status: 409 });
  }
  const hesap = (await accountStatuses(ctx, k.kurumHesaplari, { kind: 'firm', id: firma.id })).find((h) => h.institution === 'GIB') ?? null;
  if (!hesap) return Response.json({ mesaj: 'Önce firma kartında firmanın GİB hesabını kaydedin.' }, { status: 409 });
  const r = await requestJob(ctx, { kind: 'gib.etebligat', account: hesap, params: { firmId: firma.id, taxId: firma.taxId } }, k.isler);
  if (r.ok) return Response.json({ isId: r.value.jobId, mevcut: r.value.existing }, { status: r.value.existing ? 200 : 202 });
  const [durum, mesaj] = r.error === 'hesap_hatali_sifre' ? [409, 'Firmanın kayıtlı GİB şifresi hatalı; firma kartından yeni şifreyi girin.'] : (ISTEK_HATASI[r.error] ?? [400, 'İş başlatılamadı.']);
  return Response.json({ mesaj }, { status: durum });
}
