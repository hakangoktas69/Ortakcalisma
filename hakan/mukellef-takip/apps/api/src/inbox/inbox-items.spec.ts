import { describe, expect, it } from 'vitest';
import { countInbox, daysUntil, maskTckn, severityForDue, sortInbox, type InboxItem } from './inbox-items.js';

const now = new Date('2026-10-19T09:00:00');
const item = (key: string, over: Partial<InboxItem>): InboxItem => ({
  key,
  kind: 'declaration',
  severity: 'normal',
  title: key,
  subtitle: '',
  company: null,
  dueDate: null,
  date: '2026-10-01T00:00:00.000Z',
  detail: {},
  snoozedUntil: null,
  ...over,
});

describe('severityForDue', () => {
  it('geçmiş son gün gecikti, 3 gün içi yaklaşıyor, sonrası normal', () => {
    expect(severityForDue(new Date('2026-10-18'), now)).toBe('late');
    expect(severityForDue(new Date('2026-10-19T23:00:00'), now)).toBe('soon');
    expect(severityForDue(new Date('2026-10-22'), now)).toBe('soon');
    expect(severityForDue(new Date('2026-10-23'), now)).toBe('normal');
    expect(severityForDue(null, now)).toBe('normal');
    expect(severityForDue(new Date('2026-12-01'), now, true)).toBe('late');
  });
  it('gün farkını saatten bağımsız sayar', () => {
    expect(daysUntil(new Date('2026-10-20T00:30:00'), now)).toBe(1);
  });
});

describe('sortInbox', () => {
  it('önce gecikenler, sonra yaklaşanlar; grupta son günü yakın olan, son günü olmayanlar en yenisi üstte', () => {
    const sorted = sortInbox([
      item('normal-eski', { date: '2026-10-01T00:00:00.000Z' }),
      item('soon-28', { severity: 'soon', dueDate: '2026-10-22T00:00:00.000Z' }),
      item('late', { severity: 'late', dueDate: '2026-10-10T00:00:00.000Z' }),
      item('soon-20', { severity: 'soon', dueDate: '2026-10-20T00:00:00.000Z' }),
      item('normal-yeni', { date: '2026-10-18T00:00:00.000Z' }),
      item('normal-sonGun', { dueDate: '2026-11-26T00:00:00.000Z' }),
    ]);
    expect(sorted.map((i) => i.key)).toEqual(['late', 'soon-20', 'soon-28', 'normal-sonGun', 'normal-yeni', 'normal-eski']);
  });
});

describe('countInbox', () => {
  it('ertelenmiş işleri ayrı sayar, süresi dolmuş ertelemeyi aktif sayar', () => {
    const c = countInbox(
      [
        item('a', { severity: 'late' }),
        item('b', { kind: 'tebligat', severity: 'soon' }),
        item('c', { kind: 'tebligat', snoozedUntil: '2026-10-20T08:00:00.000Z' }),
        item('d', { kind: 'report', snoozedUntil: '2026-10-18T08:00:00.000Z' }),
      ],
      now,
    );
    expect(c).toMatchObject({ all: 3, late: 1, soon: 1, snoozed: 1 });
    expect(c.byKind).toMatchObject({ declaration: 1, tebligat: 1, report: 1 });
  });
});

it('maskTckn', () => {
  expect(maskTckn('12345678901')).toBe('123*****901');
});
