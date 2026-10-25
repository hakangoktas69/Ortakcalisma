import 'server-only';
import { accountStatuses, type AccountStatus } from '@eworks/credentials';
import { myAdvisorId } from '@eworks/portfolio';
import { isFinal, STATUS_LABEL, type Job } from '@eworks/sync';
import { konteyner } from './konteyner.ts';

// Kurum işi yardımcıları (BFF): işin kullanacağı hesap ve istemciye giden iş görünümü. Görünümde kurum yanıtı, şifre,
// kişisel veri yoktur; yalnız durum, sabit Türkçe metin ve sayısal özet.

type Ctx = { sub: string; org: string };

/** Oturumdaki müşavirin GİB hesabı (sözleşme listesi bu hesapla okunur). */
export async function musavirGibHesabi(ctx: Ctx): Promise<AccountStatus | null> {
  const k = konteyner();
  const musavir = await myAdvisorId(ctx, k.firmalar);
  if (!musavir) return null;
  const h = (await accountStatuses(ctx, k.kurumHesaplari, { kind: 'advisor', id: musavir })).find((a) => a.institution === 'GIB');
  return h ?? null;
}

export type IsGorunumu = { id: string; durum: Job['status']; etiket: string; mesaj: string | null; bitti: boolean; bitis: string | null };

export const isGorunumu = (j: Job): IsGorunumu => ({
  id: j.id,
  durum: j.status,
  etiket: STATUS_LABEL[j.status],
  mesaj: j.statusMessage,
  bitti: isFinal(j.status),
  bitis: j.finishedAt ? new Date(j.finishedAt).toISOString() : null,
});

export const ISTEK_HATASI: Record<string, [number, string]> = {
  hesap_yok: [409, 'Önce Kurum hesapları sayfasından müşavir GİB hesabınızı kaydedin.'],
  hesap_hatali_sifre: [409, 'Kayıtlı GİB şifresi hatalı. Kurum hesapları sayfasından yeni şifreyi girin.'],
  hesap_kullanilamaz: [409, 'GİB hesabı şu an kullanılamıyor (kilitli ya da devre dışı).'],
  oturum_yok: [401, 'Oturum gerekli.'],
};
