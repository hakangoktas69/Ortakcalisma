import { afterFailure, isLocked, LOCK_MINUTES, MAX_FAILED } from './login-lock.js';

const now = new Date('2026-10-21T10:00:00Z');

describe('giriş kilidi', () => {
  it('eşiğe kadar sayar, kilitlemez', () => {
    expect(afterFailure(0, now)).toEqual({ failedLogins: 1, lockedUntil: null });
    expect(afterFailure(MAX_FAILED - 2, now)).toEqual({ failedLogins: MAX_FAILED - 1, lockedUntil: null });
  });
  it('eşikte kilitler ve sayacı sıfırlar', () => {
    const r = afterFailure(MAX_FAILED - 1, now);
    expect(r.failedLogins).toBe(0);
    expect(r.lockedUntil?.getTime()).toBe(now.getTime() + LOCK_MINUTES * 60_000);
  });
  it('kilit süresi geçince açılır', () => {
    expect(isLocked(null, now)).toBe(false);
    expect(isLocked(new Date(now.getTime() + 1000), now)).toBe(true);
    expect(isLocked(new Date(now.getTime() - 1000), now)).toBe(false);
  });
});
