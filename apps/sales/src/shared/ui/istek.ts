// İstemci → BFF isteği: aynı köken, CSRF belirteci başlıkta, JSON. Sunucu hata mesajı Türkçe ve kişisel veri içermez.
export type Yanit<T> = { ok: true; veri: T } | { ok: false; mesaj: string; alanlar?: { alan: string; mesaj: string }[] };

export async function istek<T = unknown>(url: string, method: 'POST' | 'PUT' | 'DELETE', csrf: string, govde?: unknown): Promise<Yanit<T>> {
  try {
    const r = await fetch(url, {
      method,
      headers: { 'content-type': 'application/json', 'x-csrf-token': csrf },
      body: govde === undefined ? null : JSON.stringify(govde),
      credentials: 'same-origin',
    });
    const veri = (await r.json().catch(() => ({}))) as Record<string, unknown>;
    if (r.ok) return { ok: true, veri: veri as T };
    return {
      ok: false,
      mesaj: typeof veri['mesaj'] === 'string' ? veri['mesaj'] : `İşlem tamamlanamadı (${r.status}).`,
      ...(Array.isArray(veri['alanlar']) ? { alanlar: veri['alanlar'] as { alan: string; mesaj: string }[] } : {}),
    };
  } catch {
    return { ok: false, mesaj: 'Sunucuya ulaşılamadı.' };
  }
}
