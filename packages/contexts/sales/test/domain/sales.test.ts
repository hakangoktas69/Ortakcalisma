import { describe, expect, it } from 'vitest';
import {
  accountStatus,
  afterFailure,
  DEFAULT_TRIAL_DAYS,
  findPlan,
  formatPhone,
  isLocked,
  normalizePhone,
  passwordProblem,
  PLANS,
  trialEnd,
  validateNewOffice,
} from '../../src/index.ts';

const simdi = new Date('2026-10-26T09:00:00Z');
const gun = (n: number) => new Date(simdi.getTime() + n * 86_400_000);

describe('satış kullanıcısı girişi: art arda hatalı deneme kilidi', () => {
  it('beşinci hatada 15 dakika kilitlenir, sayaç sıfırlanır', () => {
    expect(afterFailure(0, simdi)).toEqual({ failedLogins: 1, lockedUntil: null });
    expect(afterFailure(3, simdi)).toEqual({ failedLogins: 4, lockedUntil: null });
    expect(afterFailure(4, simdi)).toEqual({ failedLogins: 0, lockedUntil: new Date(simdi.getTime() + 15 * 60_000) });
  });

  it('kilit süresi dolunca kalkar', () => {
    expect(isLocked(null, simdi)).toBe(false);
    expect(isLocked(new Date(simdi.getTime() + 1000), simdi)).toBe(true);
    expect(isLocked(simdi, simdi)).toBe(false);
  });
});

describe('parola kuralı', () => {
  it('en az 12 karakter, harf ve rakam içerir; Türkçe harf harf sayılır', () => {
    expect(passwordProblem('kisa1')).toBe('Parola en az 12 karakter olmalı.');
    expect(passwordProblem('sadeceharflerden')).toBe('Parola harf ve rakam içermeli.');
    expect(passwordProblem('123456789012')).toBe('Parola harf ve rakam içermeli.');
    expect(passwordProblem('çğışöü123456')).toBeNull();
    expect(passwordProblem('a'.repeat(200) + '1')).toBe('Parola en fazla 128 karakter olmalı.');
  });
});

describe('ofis satış hesabı: lisans', () => {
  it('deneme süresi gün olarak eklenir', () => {
    expect(trialEnd(simdi, DEFAULT_TRIAL_DAYS)).toEqual(gun(14));
  });

  it('durum: dondurma önce gelir, sonra süre; deneme bitişinden ileri uzatılmadıysa deneme', () => {
    expect(accountStatus({ frozen: true, expiresAt: gun(30), trialEndsAt: null }, simdi)).toBe('donduruldu');
    expect(accountStatus({ frozen: false, expiresAt: gun(-1), trialEndsAt: gun(-1) }, simdi)).toBe('suresi_doldu');
    expect(accountStatus({ frozen: false, expiresAt: simdi, trialEndsAt: null }, simdi)).toBe('suresi_doldu');
    expect(accountStatus({ frozen: false, expiresAt: gun(14), trialEndsAt: gun(14) }, simdi)).toBe('deneme');
    expect(accountStatus({ frozen: false, expiresAt: gun(60), trialEndsAt: gun(14) }, simdi)).toBe('aktif');
    expect(accountStatus({ frozen: false, expiresAt: gun(60), trialEndsAt: null }, simdi)).toBe('aktif');
  });

  it('lisansı olmayan ofis (hesap açma komutuyla açılmış) süresiz sayılır', () => {
    expect(accountStatus({ frozen: false, expiresAt: null, trialEndsAt: null }, simdi)).toBe('suresiz');
  });

  it('paketler sabit listeden; bilinmeyen paket yok', () => {
    expect(PLANS.map((p) => p.key)).toEqual(['baslangic', 'pro', 'kurumsal']);
    expect(findPlan('pro')?.companyQuota).toBe(150);
    expect(findPlan('bedava')).toBeNull();
  });
});

describe('telefon', () => {
  it('Türkiye numarası E.164 biçimine (başta + olmadan) çevrilir', () => {
    for (const g of ['0532 123 45 67', '+90 (532) 123-45-67', '5321234567', '00905321234567', '905321234567']) expect(normalizePhone(g), g).toBe('905321234567');
    expect(normalizePhone('0212 555 66 77')).toBe('902125556677');
  });

  it('geçersiz numara reddedilir', () => {
    for (const g of ['', '12345', '0632 123 45 67', 'abc', '0532 123 45 678']) expect(normalizePhone(g), g).toBeNull();
  });

  it('ekranda okunur biçimde gösterilir', () => {
    expect(formatPhone('905321234567')).toBe('+90 532 123 45 67');
    expect(formatPhone(null)).toBe('');
    expect(formatPhone('123')).toBe('123');
  });
});

describe('yeni ofis formu', () => {
  const gecerli = { officeName: ' Yıldız Mali Müşavirlik ', contactName: ' Ayşe Yıldız ', email: ' Ayse@Ornek.TEST ', phone: '0532 123 45 67', plan: 'pro', trialDays: '14' };

  it('geçerli girdi temizlenir: boşluk kırpılır, e-posta küçük harf, telefon E.164, deneme günü sayı', () => {
    expect(validateNewOffice(gecerli)).toEqual({
      ok: true,
      value: { officeName: 'Yıldız Mali Müşavirlik', contactName: 'Ayşe Yıldız', email: 'ayse@ornek.test', phone: '905321234567', plan: 'pro', trialDays: 14 },
    });
  });

  it('deneme günü boşsa varsayılan 14 gün', () => {
    const r = validateNewOffice({ ...gecerli, trialDays: '' });
    expect(r.ok && r.value.trialDays).toBe(14);
  });

  it('her hatalı alan ayrı mesajla döner', () => {
    const r = validateNewOffice({ officeName: ' ', contactName: '', email: 'eposta-degil', phone: '123', plan: 'bedava', trialDays: '91' });
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.errors.map((e) => e.field)).toEqual(['officeName', 'contactName', 'email', 'phone', 'plan', 'trialDays']);
  });

  it('sınır değerler: 200 karakterlik ad geçer, 201 geçmez; deneme 1–90 gün, kesirli olmaz', () => {
    expect(validateNewOffice({ ...gecerli, officeName: 'Ş'.repeat(200) }).ok).toBe(true);
    expect(validateNewOffice({ ...gecerli, officeName: 'Ş'.repeat(201) }).ok).toBe(false);
    expect(validateNewOffice({ ...gecerli, trialDays: '1' }).ok).toBe(true);
    expect(validateNewOffice({ ...gecerli, trialDays: '90' }).ok).toBe(true);
    expect(validateNewOffice({ ...gecerli, trialDays: '0' }).ok).toBe(false);
    expect(validateNewOffice({ ...gecerli, trialDays: '2.5' }).ok).toBe(false);
  });
});
