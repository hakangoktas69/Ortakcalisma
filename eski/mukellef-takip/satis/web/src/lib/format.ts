import type { OfficeStatus } from "./api";

export const STATUS_LABEL: Record<OfficeStatus, string> = {
  aktif: "Aktif",
  deneme: "Deneme",
  "suresi-doldu": "Süresi doldu",
  donduruldu: "Donduruldu",
};

export const STATUS_STYLE: Record<OfficeStatus, string> = {
  aktif: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  deneme: "bg-sky-50 text-sky-700 ring-sky-200",
  "suresi-doldu": "bg-red-50 text-red-700 ring-red-200",
  donduruldu: "bg-slate-100 text-slate-700 ring-slate-300",
};

const dateFmt = new Intl.DateTimeFormat("tr-TR", { day: "2-digit", month: "2-digit", year: "numeric", timeZone: "Europe/Istanbul" });
const dateTimeFmt = new Intl.DateTimeFormat("tr-TR", { dateStyle: "short", timeStyle: "short", timeZone: "Europe/Istanbul" });

export const formatDate = (iso: string | null | undefined) => (iso ? dateFmt.format(new Date(iso)) : "—");
export const formatDateTime = (iso: string | null | undefined) => (iso ? dateTimeFmt.format(new Date(iso)) : "—");

/** Bugünden kaç gün sonra (geçmişse negatif); tarih yoksa null. */
export function daysLeft(iso: string | null | undefined, now = new Date()): number | null {
  if (!iso) return null;
  return Math.ceil((new Date(iso).getTime() - now.getTime()) / 86_400_000);
}

/** "905321234567" → "+90 532 123 45 67" */
export function formatPhone(e164: string | null | undefined): string {
  if (!e164) return "—";
  if (!/^90\d{10}$/.test(e164)) return e164;
  return `+90 ${e164.slice(2, 5)} ${e164.slice(5, 8)} ${e164.slice(8, 10)} ${e164.slice(10)}`;
}

/** Satış işlem kaydı eylemlerinin okunur adı */
const ACTIONS: Record<string, string> = {
  "sales.office.create": "Büro açıldı",
  "sales.office.update": "Bilgiler güncellendi",
  "sales.office.extend": "Lisans uzatıldı",
  "sales.office.suspend": "Büro donduruldu",
  "sales.office.resume": "Büro açıldı (dondurma kaldırıldı)",
  "sales.office.user.password-reset": "Kullanıcı şifresi sıfırlandı",
  "sales.office.user.2fa-reset": "İki adımlı doğrulama sıfırlandı",
};

export const actionLabel = (action: string) => ACTIONS[action] ?? action;
