import { describe, expect, it } from 'vitest';
import { auditHash, stableStringify, verifyAuditChain } from './audit-chain.js';

function chain(n: number) {
  const rows = [];
  let prev: string | null = null;
  for (let i = 0; i < n; i++) {
    const c = { id: `a${i}`, tenantId: 't1', userId: 'u1', action: 'x', target: null, detail: { b: 2, a: [1, { d: 1, c: 2 }] }, createdAt: new Date(1_800_000_000_000 + i) };
    const hash = auditHash(prev, c);
    rows.push({ ...c, prevHash: prev, hash });
    prev = hash;
  }
  return rows;
}

describe('denetim kaydı hash zinciri', () => {
  it('anahtar sırasından bağımsız kanonik JSON', () => {
    expect(stableStringify({ b: 1, a: { d: 1, c: 2 } })).toBe(stableStringify({ a: { c: 2, d: 1 }, b: 1 }));
  });

  it('sağlam zinciri doğrular', () => {
    expect(verifyAuditChain(chain(5)).ok).toBe(true);
  });

  it('değiştirilen kaydı yakalar', () => {
    const rows = chain(5);
    rows[2] = { ...rows[2], action: 'degisti' };
    expect(verifyAuditChain(rows)).toEqual({ ok: false, brokenAt: 'a2' });
  });

  it('silinen kaydı yakalar', () => {
    const rows = chain(5);
    rows.splice(1, 1);
    expect(verifyAuditChain(rows)).toEqual({ ok: false, brokenAt: 'a2' });
  });

  it('zincir öncesi (hash yok) eski kayıtları atlar', () => {
    const old = { id: 'eski', tenantId: 't1', userId: null, action: 'y', target: null, detail: null, createdAt: new Date(0), prevHash: null, hash: null };
    expect(verifyAuditChain([old, ...chain(3)]).ok).toBe(true);
  });
});
