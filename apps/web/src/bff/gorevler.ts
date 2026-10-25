import 'server-only';
import type { TaskError } from '@eworks/workspace';

// Görev uçlarının ortak hata yanıtları (sabit Türkçe metin).
export const GOREV_HATASI: Record<TaskError, [number, string]> = {
  gecersiz: [422, 'Görev bilgilerini kontrol edin.'],
  yetki_yok: [403, 'Bu işlem için yetkiniz yok.'],
  bulunamadi: [404, 'Görev bulunamadı.'],
  catisma: [409, 'Görev başka biri tarafından değiştirildi; sayfayı yenileyin.'],
  uye_degil: [422, 'Sorumlu bu ofisin kullanıcısı değil.'],
};

export const gorevHatasi = (e: TaskError, alanlar?: { field: string; message: string }[]) => {
  const [durum, mesaj] = GOREV_HATASI[e];
  return Response.json({ mesaj, ...(alanlar ? { alanlar: alanlar.map((a) => ({ alan: a.field, mesaj: a.message })) } : {}) }, { status: durum });
};
