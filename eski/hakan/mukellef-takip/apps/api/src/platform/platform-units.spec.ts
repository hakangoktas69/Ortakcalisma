import { ArgumentsHost, Logger } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';
import { Prisma } from '../generated/prisma/client.js';
import { LOCAL_KEY_ID, VaultService } from './crypto/vault.service.js';
import { startOpenBaoTokenRenewal } from './crypto/kms.js';
import { PersonalDataService } from './crypto/personal-data.js';
import { backoffMs } from './events/outbox.dispatcher.js';
import { PrismaExceptionFilter } from './http/prisma-exception.filter.js';
import { REDACT_PATHS, scrubMessage } from './logging/logging.module.js';
import { LiveGibSource, MockGibSource } from '../modules/tax-filing/infrastructure/gib-source.js';
import { LiveTescilClient } from '../modules/social-security/infrastructure/tescil/live-tescil.client.js';

// Platform yardımcıları ve canlıya hazır olmayan istemciler için birim testleri.

const vault = () => new VaultService({ current: LOCAL_KEY_ID, keys: new Map([[LOCAL_KEY_ID, Buffer.alloc(32, 5)]]) });

describe('VaultService null güvenli yardımcılar', () => {
  it('null/undefined olduğu gibi geçer, değer şifrelenir', () => {
    const v = vault();
    expect(v.encryptNullable(null)).toBeNull();
    expect(v.encryptNullable(undefined)).toBeNull();
    expect(v.decryptNullable(null)).toBeNull();
    expect(v.decryptNullable(v.encryptNullable('x'))).toBe('x');
  });
});

describe('PersonalDataService', () => {
  it('mühürler (düz alanlar boş) ve açar; eski düz kayıtları da okur', () => {
    const p = new PersonalDataService(vault());
    const s = p.seal({ tckn: '10000000146', fullName: 'Ayşe Yılmaz' });
    expect(s).toMatchObject({ tckn: null, fullName: null });
    expect(s.tcknEnc).not.toContain('10000000146');
    expect(p.open(s)).toEqual({ tckn: '10000000146', fullName: 'Ayşe Yılmaz' });
    expect(p.open({ tckn: '1', fullName: 'Eski' })).toEqual({ tckn: '1', fullName: 'Eski' });
    expect(p.open({})).toEqual({ tckn: '', fullName: '' });
    expect(p.tcknHash('10000000146')).toBe(s.tcknHash);
  });
});

describe('log redaksiyonu', () => {
  it('mesaj metnindeki kişisel veriyi maskeler, diğer türlere dokunmaz', () => {
    expect(scrubMessage('Kullanıcı 10000000146 için hata, iban TR330006100519786457841326')).not.toMatch(/10000000146|TR3300061/);
    expect(scrubMessage(42)).toBe(42);
    expect(REDACT_PATHS).toEqual(expect.arrayContaining(['req.headers.authorization', '*.password', '*.refreshToken']));
  });
});

describe('outbox yeniden deneme aralığı', () => {
  it('üstel artar ve 1 saatle sınırlanır', () => {
    expect(backoffMs(1)).toBe(15_000);
    expect(backoffMs(2)).toBe(30_000);
    expect(backoffMs(3)).toBe(60_000);
    expect(backoffMs(50)).toBe(3_600_000);
    expect(backoffMs(0)).toBe(15_000);
  });
});

describe('OpenBao token yenileme', () => {
  it('yalnız openbao modunda, hemen ve periyodik çağırır; ağ hatası süreci düşürmez', async () => {
    const fetchImpl = vi.fn(async () => {
      throw new Error('ağ yok');
    }) as unknown as typeof fetch;
    startOpenBaoTokenRenewal({ KMS_PROVIDER: 'local', OPENBAO_ADDR: undefined, OPENBAO_TOKEN: undefined }, fetchImpl);
    expect(fetchImpl).not.toHaveBeenCalled();
    vi.useFakeTimers();
    try {
      startOpenBaoTokenRenewal({ KMS_PROVIDER: 'openbao', OPENBAO_ADDR: 'http://bao:8200/', OPENBAO_TOKEN: 't' }, fetchImpl);
      expect(fetchImpl).toHaveBeenCalledWith('http://bao:8200/v1/auth/token/renew-self', expect.objectContaining({ method: 'POST' }));
      await vi.advanceTimersByTimeAsync(12 * 3_600_000);
      expect(fetchImpl).toHaveBeenCalledTimes(2);
    } finally {
      vi.useRealTimers();
    }
  });
});

describe('PrismaExceptionFilter', () => {
  vi.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined); // beklenen hata log'u test çıktısını kirletmesin
  const run = (code: string) => {
    const res = { status: vi.fn().mockReturnThis(), json: vi.fn() };
    const host = { switchToHttp: () => ({ getResponse: () => res }) } as unknown as ArgumentsHost;
    new PrismaExceptionFilter().catch(new Prisma.PrismaClientKnownRequestError('x', { code, clientVersion: '7' }), host);
    return res;
  };
  it.each([
    ['P2002', 409],
    ['P2025', 404],
    ['P2003', 409],
    ['P2000', 400],
    ['P9999', 500],
  ])('%s → %i, iç ayrıntı sızdırmaz', (code, status) => {
    const res = run(code);
    expect(res.status).toHaveBeenCalledWith(status);
    expect(JSON.stringify(res.json.mock.calls[0][0])).not.toMatch(/Unique|constraint|"x"/);
  });
});

describe('canlıya hazır olmayan kurum istemcileri', () => {
  it('GİB canlı kaynağı açık hata verir; demo kaynağı deterministik', async () => {
    await expect(new LiveGibSource().filed()).rejects.toThrow(/henüz kurulmadı/);
    const mock = new MockGibSource();
    const a = await mock.filed(['1234567890', '10000000146'], 2026, 8);
    expect(a).toEqual(await mock.filed(['1234567890', '10000000146'], 2026, 8));
    expect(a.every((d) => ['1234567890', '10000000146'].includes(d.taxNumber))).toBe(true);
  });

  it('4A canlı istemcisi kılavuz gelene kadar istek atmaz', async () => {
    const c = new LiveTescilClient();
    await expect(c.verify()).rejects.toThrow();
    await expect(c.entries()).rejects.toThrow();
    await expect(c.exits()).rejects.toThrow();
  });
});
