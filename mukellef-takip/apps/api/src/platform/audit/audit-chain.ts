import { createHash } from 'node:crypto';

// Denetim kaydı hash zinciri: her kayıt, aynı büronun bir önceki kaydının hash'ini içerir.
// Bir kayıt sonradan değiştirilir veya silinirse zincir o noktadan itibaren doğrulanamaz.

export interface AuditContent {
  tenantId: string;
  userId?: string | null;
  action: string;
  target?: string | null;
  detail?: unknown;
  createdAt: Date;
}

/** Anahtarları sıralı JSON: PostgreSQL jsonb anahtar sırasını değiştirdiğinden doğrulama okunan veriyle aynı sonucu verir. */
export function stableStringify(v: unknown): string {
  if (v === null || v === undefined) return 'null';
  if (v instanceof Date) return JSON.stringify(v.toISOString());
  if (Array.isArray(v)) return `[${v.map(stableStringify).join(',')}]`;
  if (typeof v === 'object') {
    const o = v as Record<string, unknown>;
    return `{${Object.keys(o)
      .filter((k) => o[k] !== undefined)
      .sort()
      .map((k) => `${JSON.stringify(k)}:${stableStringify(o[k])}`)
      .join(',')}}`;
  }
  return JSON.stringify(v);
}

export function auditHash(prevHash: string | null, c: AuditContent): string {
  const body = stableStringify({
    tenantId: c.tenantId,
    userId: c.userId ?? null,
    action: c.action,
    target: c.target ?? null,
    detail: c.detail ?? null,
    createdAt: c.createdAt,
  });
  return createHash('sha256').update(`${prevHash ?? ''}|${body}`).digest('hex');
}

/** Sıralı (seq artan) kayıtları doğrular; ilk bozuk kaydın kimliğini döner. */
export function verifyAuditChain(rows: (AuditContent & { id: string; prevHash: string | null; hash: string | null })[]) {
  let prev: string | null = null;
  for (const r of rows) {
    if (!r.hash) continue; // Zincir öncesi (eski) kayıtlar
    if (r.prevHash !== prev || auditHash(prev, r) !== r.hash) return { ok: false as const, brokenAt: r.id };
    prev = r.hash;
  }
  return { ok: true as const, last: prev };
}
