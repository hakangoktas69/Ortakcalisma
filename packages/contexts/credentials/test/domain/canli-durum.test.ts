import { describe, expect, it } from 'vitest';
import { combineLiveStatus, liveStatus, liveStatusLabel } from '../../src/index.ts';

// G/S/V kutuları (Mert 26.10, 5800f5c): yalnız kurumda doğrulanmış giriş "aktif" sayılır; şifrenin kayıtlı olması kanıt değildir.
const hesap = (o: Partial<{ status: 'active' | 'wrong_password' | 'locked' | 'disabled'; updatedAt: string; lastSuccessAt: string | null }>) => ({
  status: 'active' as const,
  updatedAt: '2026-10-26T10:00:00.000Z',
  lastSuccessAt: null,
  ...o,
});

describe('kurum hesabının canlı durumu', () => {
  it('hesap yoksa ya da yalnız kayıtlıysa doğrulanmadı', () => {
    expect(liveStatus(undefined)).toEqual({ state: 'unknown', checkedAt: null });
    expect(liveStatus(hesap({}))).toEqual({ state: 'unknown', checkedAt: null });
  });

  it('kayıttan sonra başarılı giriş varsa aktif; bilgiler sonradan değiştiyse yeniden doğrulanana dek bilinmiyor', () => {
    expect(liveStatus(hesap({ lastSuccessAt: '2026-10-26T11:00:00.000Z' }))).toEqual({ state: 'active', checkedAt: '2026-10-26T11:00:00.000Z' });
    expect(liveStatus(hesap({ lastSuccessAt: '2026-10-26T10:00:00.000Z' })).state).toBe('active');
    expect(liveStatus(hesap({ lastSuccessAt: '2026-10-25T09:00:00.000Z' })).state).toBe('unknown');
  });

  it('hatalı şifre, kilit ve devre dışı aktif değildir (önceki başarı geçersiz)', () => {
    for (const status of ['wrong_password', 'locked', 'disabled'] as const) {
      expect(liveStatus(hesap({ status, lastSuccessAt: '2026-10-26T11:00:00.000Z' })).state).toBe('inactive');
    }
  });

  it('bozuk zaman damgası aktif sayılmaz', () => {
    expect(liveStatus(hesap({ lastSuccessAt: 'dün' })).state).toBe('unknown');
  });

  it('etiketler', () => {
    expect(liveStatusLabel('active')).toBe('Aktif');
    expect(liveStatusLabel('inactive')).toBe('Aktif değil');
    expect(liveStatusLabel('unknown')).toBe('Doğrulanmadı');
  });
});

describe('birden çok hesabın birleşik durumu (SGK işyerleri)', () => {
  it('biri aktif değilse aktif değil; hepsi aktifse aktif (en eski kontrol); diğer durumda ya da hesap yoksa doğrulanmadı', () => {
    const a = { state: 'active' as const, checkedAt: '2026-10-26T11:00:00.000Z' };
    const b = { state: 'active' as const, checkedAt: '2026-10-20T11:00:00.000Z' };
    expect(combineLiveStatus([a, b])).toEqual({ state: 'active', checkedAt: '2026-10-20T11:00:00.000Z' });
    expect(combineLiveStatus([a, { state: 'inactive', checkedAt: '2026-10-25T00:00:00.000Z' }]).state).toBe('inactive');
    expect(combineLiveStatus([a, { state: 'unknown', checkedAt: null }])).toEqual({ state: 'unknown', checkedAt: null });
    expect(combineLiveStatus([])).toEqual({ state: 'unknown', checkedAt: null });
  });
});
