import { describe, expect, it } from 'vitest';
import { LOCAL_KEY_ID, VaultService } from './vault.service.js';
import { loadKeyRing } from './kms.js';

const k = (n: number) => Buffer.alloc(32, n);
const LOCAL = k(1).toString('base64');

describe('VaultService', () => {
  it('v1 biçimi (yerel anahtar) geriye uyumlu', () => {
    const v = new VaultService({ current: LOCAL_KEY_ID, keys: new Map([[LOCAL_KEY_ID, k(1)]]) });
    const enc = v.encrypt('sgk-sifre');
    expect(enc.startsWith('v1:')).toBe(true);
    expect(enc.split(':')).toHaveLength(4);
    expect(v.decrypt(enc)).toBe('sgk-sifre');
  });

  it('v2 ile yazar, eski v1 kaydı okumaya devam eder ve döndürülmesi gerektiğini bildirir', () => {
    const old = new VaultService({ current: LOCAL_KEY_ID, keys: new Map([[LOCAL_KEY_ID, k(1)]]) }).encrypt('eski');
    const v = new VaultService({ current: 'b1abc', keys: new Map([['b1abc', k(2)], [LOCAL_KEY_ID, k(1)]]) });
    const enc = v.encrypt('yeni');
    expect(enc.startsWith('v2:b1abc:')).toBe(true);
    expect(v.decrypt(enc)).toBe('yeni');
    expect(v.decrypt(old)).toBe('eski');
    expect(v.needsRotation(old)).toBe(true);
    expect(v.needsRotation(enc)).toBe(false);
  });

  it('değiştirilmiş şifreli veriyi reddeder (GCM bütünlüğü)', () => {
    const v = new VaultService({ current: LOCAL_KEY_ID, keys: new Map([[LOCAL_KEY_ID, k(1)]]) });
    const [ver, iv, tag, ct] = v.encrypt('x').split(':');
    const bad = Buffer.from(ct, 'base64');
    bad[0] ^= 1;
    expect(() => v.decrypt([ver, iv, tag, bad.toString('base64')].join(':'))).toThrow();
  });

  it('blind index kararlı, amaç ve anahtara bağlı', () => {
    const a = new VaultService({ current: LOCAL_KEY_ID, keys: new Map([[LOCAL_KEY_ID, k(1)]]) });
    const b = new VaultService({ current: LOCAL_KEY_ID, keys: new Map([[LOCAL_KEY_ID, k(3)]]) });
    expect(a.blindIndex('tckn', '10000000146')).toBe(a.blindIndex('tckn', '10000000146'));
    expect(a.blindIndex('tckn', '10000000146')).not.toBe(a.blindIndex('phone', '10000000146'));
    expect(a.blindIndex('tckn', '10000000146')).not.toBe(b.blindIndex('tckn', '10000000146'));
  });
});

describe('loadKeyRing (OpenBao)', () => {
  it('sarılmış anahtarı Transit ile çözer, VAULT_KEY varsa eski anahtarı da ekler', async () => {
    const calls: { url: string; init: RequestInit }[] = [];
    const fakeFetch = (async (url: string, init: RequestInit) => {
      calls.push({ url, init });
      return new Response(JSON.stringify({ data: { plaintext: k(9).toString('base64') } }), { status: 200 });
    }) as unknown as typeof fetch;
    const ring = await loadKeyRing(
      { KMS_PROVIDER: 'openbao', OPENBAO_ADDR: 'http://bao:8200/', OPENBAO_TOKEN: 'tok', OPENBAO_TRANSIT_KEY: 'mukellef', OPENBAO_WRAPPED_DEK: 'vault:v3:abc', VAULT_KEY: LOCAL },
      fakeFetch,
    );
    expect(calls[0].url).toBe('http://bao:8200/v1/transit/decrypt/mukellef');
    expect((calls[0].init.headers as Record<string, string>)['X-Vault-Token']).toBe('tok');
    expect(ring.current).toMatch(/^b3[0-9a-f]{6}$/);
    expect(ring.keys.get(ring.current)).toEqual(k(9));
    expect(ring.keys.has(LOCAL_KEY_ID)).toBe(true);
  });

  it('kasa mühürlüyse anlaşılır hata verir', async () => {
    const fakeFetch = (async () => new Response('sealed', { status: 503 })) as unknown as typeof fetch;
    await expect(
      loadKeyRing({ KMS_PROVIDER: 'openbao', OPENBAO_ADDR: 'http://bao', OPENBAO_TOKEN: 't', OPENBAO_TRANSIT_KEY: 'k', OPENBAO_WRAPPED_DEK: 'vault:v1:x' }, fakeFetch),
    ).rejects.toThrow(/mühürlü/);
  });
});
