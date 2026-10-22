// Art arda hatalı giriş kilidi (müşavir sitesiyle aynı eşikler): 5 hatadan sonra 15 dakika.
export const MAX_FAILED = 5;
export const LOCK_MINUTES = 15;

export const isLocked = (lockedUntil: Date | null, now = new Date()) => !!lockedUntil && lockedUntil > now;

/** Hatalı denemeden sonraki sayaç; eşiğe ulaşınca kilit ve sayaç sıfırlanır. */
export function afterFailure(failedLogins: number, now = new Date()): { failedLogins: number; lockedUntil: Date | null } {
  const next = failedLogins + 1;
  if (next >= MAX_FAILED) return { failedLogins: 0, lockedUntil: new Date(now.getTime() + LOCK_MINUTES * 60_000) };
  return { failedLogins: next, lockedUntil: null };
}
