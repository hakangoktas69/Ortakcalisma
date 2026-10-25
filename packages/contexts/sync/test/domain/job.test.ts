import { describe, expect, it } from 'vitest';
import { canTransition, isFinal, isStale, JOB_KINDS, JOB_PERMISSION, STATUS_LABEL } from '../../src/index.ts';

describe('kurum işi durum makinesi', () => {
  it('sonuç durumları kesindir; ikinci sonuç geçişi yoktur', () => {
    expect(canTransition('queued', 'running')).toBe(true);
    expect(canTransition('running', 'succeeded')).toBe(true);
    expect(canTransition('running', 'wrong_password')).toBe(true);
    expect(canTransition('queued', 'succeeded')).toBe(false);
    for (const s of ['succeeded', 'failed', 'wrong_password', 'cancelled'] as const) {
      expect(isFinal(s)).toBe(true);
      expect(canTransition(s, 'running')).toBe(false);
    }
    expect(isFinal('running')).toBe(false);
  });

  it('her iş türünün bir yetki anahtarı ve her durumun Türkçe etiketi vardır', () => {
    for (const k of JOB_KINDS) expect(JOB_PERMISSION[k]).toMatch(/^[a-z_.]+$/);
    expect(STATUS_LABEL.wrong_password).toBe('Kurum şifresi hatalı');
  });

  it('takılı iş: yalnız başlamış ve süreyi aşmış iş', () => {
    const simdi = new Date('2026-10-25T12:00:00Z');
    expect(isStale(null, simdi)).toBe(false);
    expect(isStale(new Date('2026-10-25T11:50:00Z'), simdi)).toBe(false);
    expect(isStale(new Date('2026-10-25T11:30:00Z'), simdi)).toBe(true);
  });
});
