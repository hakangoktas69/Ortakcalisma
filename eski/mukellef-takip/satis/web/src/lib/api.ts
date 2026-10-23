// Satış API istemcisi. Oturum HttpOnly çerezde (tarayıcı betiği okuyamaz); bu dosya anahtar saklamaz.
// Her istek "X-Satis: 1" başlığını taşır: API veri değiştiren isteği bu başlık olmadan reddeder (CSRF).

export const BASE_PATH = "/satis";
const API = "/api/satis";

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
    public code?: string,
  ) {
    super(message);
  }
}

/** Tam sayfa yönlendirme: oturum düşünce bellekteki tüm durum sıfırlanır. */
function go(path: string) {
  // eslint-disable-next-line @next/next/no-location-assign-relative-destination
  if (typeof window !== "undefined" && window.location.pathname !== BASE_PATH + path) window.location.assign(BASE_PATH + path);
}

export async function api<T>(path: string, init: { method?: string; body?: unknown } = {}): Promise<T> {
  const res = await fetch(API + path, {
    method: init.method ?? (init.body === undefined ? "GET" : "POST"),
    credentials: "same-origin",
    headers: { "Content-Type": "application/json", "X-Satis": "1" },
    body: init.body === undefined ? undefined : JSON.stringify(init.body),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    if (res.status === 401 && !path.startsWith("/auth/")) go("/giris");
    if (res.status === 403 && body.code === "PASSWORD_CHANGE_REQUIRED") go("/sifre");
    const msg = Array.isArray(body.message) ? body.message.join(", ") : body.message;
    throw new ApiError(res.status, msg ?? "Bir hata oluştu", body.code);
  }
  return body as T;
}

export const errorText = (e: unknown) => (e instanceof Error ? e.message : "Bir hata oluştu");

// ─── Yanıt tipleri (satis/api) ────────────────────────────────────────────────────────────────

export type OfficeStatus = "aktif" | "deneme" | "suresi-doldu" | "donduruldu";

export interface OfficeRow {
  id: string;
  name: string;
  contactName: string | null;
  contactEmail: string | null;
  contactPhone: string | null;
  plan: string | null;
  expiresAt: string | null;
  companyCount: number;
  status: OfficeStatus;
  createdAt: string;
}

export interface OfficeUser {
  id: string;
  fullName: string;
  email: string;
  role: "ADMIN" | "STAFF";
  isActive: boolean;
  mustChangePassword: boolean;
  twoFactorEnabled: boolean;
  locked: boolean;
  lastLoginAt: string | null;
  createdAt: string;
}

export interface HistoryItem {
  id: string;
  action: string;
  detail: Record<string, unknown> | null;
  createdAt: string;
  by: string | null;
}

export interface OfficeDetail extends Omit<OfficeRow, "contactPhone"> {
  contactPhone: string | null;
  companyQuota: number | null;
  trialEndsAt: string | null;
  suspendedAt: string | null;
  require2fa: boolean;
  users: OfficeUser[];
  history: HistoryItem[];
}

export interface Plan {
  key: string;
  name: string;
  companyQuota: number;
}

export interface Me {
  id: string;
  email: string;
  fullName: string;
  mustChangePassword: boolean;
}

export interface TeamMember {
  id: string;
  email: string;
  fullName: string;
  isActive: boolean;
  mustChangePassword: boolean;
  twoFactorEnabled: boolean;
  locked: boolean;
  lastLoginAt: string | null;
  isMe: boolean;
}
