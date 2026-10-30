import { accountStatuses, activeConsentFirmIds } from '@eworks/credentials';
import { listFirms } from '@eworks/portfolio';
import { requestJob } from '@eworks/sync';
import { topluOzet, topluTebligatKarari } from '@/bff/tebligat-toplu.ts';
import { konteyner } from '@/bff/konteyner.ts';
import { apiIzni, baglam } from '@/bff/oturum.ts';

// "Tüm mükelleflerin e-Tebligatını çek" (tebligat.liste.sync; D45, D46). e-Tebligat her firmanın KENDİ GİB
// hesabıyla okunur, bu yüzden toplu çekim firma başına ayrı iştir (beyannamede tek müşavir oturumu yeterliydi).
// Kapsam RLS ile sınırlıdır; onayı, hesabı olmayan ya da şifresi hatalı firma atlanır ve sayılır — hiçbiri hata
// değildir. Kuruma giden istekler ACL'deki ortak hız sınırından geçer.
export async function POST(req: Request) {
  const s = await apiIzni(req, 'tebligat.liste.sync', true);
  if (s instanceof Response) return s;
  const ctx = baglam(s);
  const k = konteyner();

  const [firmalar, onayli, hesaplar] = await Promise.all([
    listFirms(ctx, {}, k.firmalar),
    activeConsentFirmIds(ctx, k.onaylar),
    accountStatuses(ctx, k.kurumHesaplari),
  ]);
  const karar = topluTebligatKarari(
    firmalar.map((f) => ({ id: f.id, title: f.title, taxId: f.taxId, archivedAt: f.archivedAt })),
    onayli,
    hesaplar,
  );

  const isler: string[] = [];
  const basarisiz: { title: string; neden: 'arsiv' | 'onay_yok' | 'hesap_yok' | 'hesap_kullanilamaz' }[] = [...karar.atlanan];
  for (const aday of karar.acilacak) {
    const r = await requestJob(ctx, { kind: 'gib.etebligat', account: aday.hesap, params: { firmId: aday.id, taxId: aday.taxId } }, k.isler);
    // Zaten çalışan iş varsa yenisi açılmaz (idempotent); kullanıcıya yine "başlatıldı" sayılır
    if (r.ok) isler.push(r.value.jobId);
    else basarisiz.push({ title: firmalar.find((f) => f.id === aday.id)?.title ?? '—', neden: 'hesap_kullanilamaz' });
  }

  return Response.json({ acilan: isler.length, atlanan: basarisiz.length, isler, mesaj: topluOzet(isler.length, basarisiz) }, { status: isler.length > 0 ? 202 : 200 });
}
