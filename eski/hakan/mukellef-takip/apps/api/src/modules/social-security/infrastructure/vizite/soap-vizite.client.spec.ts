import { afterEach, describe, expect, it, vi } from 'vitest';
import { ViziteError, parseSgkDate, toSgkDate } from '../../application/ports/vizite.types.js';
import { SoapViziteClient } from './soap-vizite.client.js';

// SGK Vizite SOAP istemcisi: zarf biçimi, yanıt ayrıştırma ve hata kodları (gerçek servise gitmeden).

const envelope = (method: string, inner: string) =>
  `<?xml version="1.0"?><soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/"><soapenv:Body>` +
  `<ns:${method}Response xmlns:ns="http://service.com"><ns:${method}Return>${inner}</ns:${method}Return></ns:${method}Response></soapenv:Body></soapenv:Envelope>`;

const calls: { body: string; action: string }[] = [];
function stubSgk(responses: Record<string, string | { status: number; text: string }>) {
  calls.length = 0;
  vi.stubGlobal('fetch', async (_url: string, init: RequestInit) => {
    const action = String((init.headers as Record<string, string>).SOAPAction);
    calls.push({ body: String(init.body), action });
    const r = responses[action];
    if (typeof r === 'object') return new Response(r.text, { status: r.status });
    return new Response(r ?? '', { status: 200 });
  });
}
afterEach(() => vi.unstubAllGlobals());

const creds = { kullaniciAdi: '10000000146', isyeriKodu: '1234', isyeriSifresi: 'a<b&c' };

describe('SoapViziteClient', () => {
  const client = new SoapViziteClient();

  it('giriş: zarfı doğru isim alanıyla gönderir, özel karakterleri kaçırır, token döner', async () => {
    stubSgk({ wsLogin: envelope('wsLogin', '<sonucKod>0</sonucKod><wsToken>TKN-1</wsToken>') });
    expect(await client.login(creds)).toBe('TKN-1');
    expect(calls[0].body).toContain('xmlns:ser="http://service.com"');
    expect(calls[0].body).toContain('<isyeriSifresi>a&lt;b&amp;c</isyeriSifresi>');
  });

  it('bekleyen raporlar: dizi ve tekil yanıt, kimlik numaraları metin kalır', async () => {
    const bean = (id: string) => `<RaporAramaTarihleBean><MEDULARAPORID>${id}</MEDULARAPORID><TCKIMLIKNO>01234567890</TCKIMLIKNO></RaporAramaTarihleBean>`;
    stubSgk({ raporAramaTarihile: envelope('raporAramaTarihile', `<sonucKod>0</sonucKod><raporAramaTarihleBeanArray>${bean('000123')}${bean('000124')}</raporAramaTarihleBeanArray>`) });
    const rows = await client.pendingReports(creds, 'T', new Date(2026, 9, 20));
    expect(rows).toHaveLength(2);
    expect(rows[0].MEDULARAPORID).toBe('000123');
    expect(rows[0].TCKIMLIKNO).toBe('01234567890');
    expect(calls[0].body).toContain('<tarih>20.10.2026</tarih>');

    stubSgk({ raporAramaTarihile: envelope('raporAramaTarihile', `<sonucKod>0</sonucKod><raporAramaTarihleBeanArray>${bean('9')}</raporAramaTarihleBeanArray>`) });
    expect(await client.pendingReports(creds, 'T', new Date())).toHaveLength(1);
  });

  it('kayıt yok (503/505) boş liste, diğer hata kodları fırlatılır', async () => {
    stubSgk({ onayliRaporlarTarihile: envelope('onayliRaporlarTarihile', '<sonucKod>505</sonucKod><sonucAciklama>Kayıt yok</sonucAciklama>') });
    expect(await client.approvedReports(creds, 'T', new Date(), new Date())).toEqual([]);
    stubSgk({ raporAramaTarihile: envelope('raporAramaTarihile', '<sonucKod>106</sonucKod><sonucAciklama>Token süresi doldu</sonucAciklama>') });
    const e = await client.pendingReports(creds, 'T', new Date()).catch((x: unknown) => x);
    expect(e).toBeInstanceOf(ViziteError);
    expect((e as ViziteError).isAuthError).toBe(true);
  });

  it('SOAP Fault, HTTP hatası ve beklenmeyen yanıt anlaşılır hataya çevrilir', async () => {
    stubSgk({ wsLogin: '<Envelope><Body><Fault><faultstring>Sunucu meşgul</faultstring></Fault></Body></Envelope>' });
    await expect(client.login(creds)).rejects.toThrow(/Sunucu meşgul/);
    stubSgk({ wsLogin: { status: 502, text: 'Bad gateway' } });
    await expect(client.login(creds)).rejects.toThrow(/HTTP 502/);
    stubSgk({ wsLogin: envelope('baskaMetot', '<sonucKod>0</sonucKod>') });
    await expect(client.login(creds)).rejects.toThrow(/Beklenmeyen yanıt/);
  });

  it('okundu kapatma ve çalışmazlık onayı doğru alanlarla gider', async () => {
    stubSgk({ raporOkunduKapat: envelope('raporOkunduKapat', '<sonucKod>0</sonucKod>'), raporOnay: envelope('raporOnay', '<sonucKod>0</sonucKod>') });
    await client.markRead(creds, 'T', '000123');
    await client.approve(creds, 'T', { tckn: '10000000146', vaka: 3, medulaRaporId: '000123', nitelikDurumu: '1', tarih: new Date(2026, 9, 1) });
    expect(calls.map((c) => c.action)).toEqual(['raporOkunduKapat', 'raporOnay']);
    expect(calls[1].body).toContain('<tckNo>10000000146</tckNo>');
    expect(calls[1].body).toContain('<tarih>01.10.2026</tarih>');
  });
});

describe('Vizite yardımcıları', () => {
  it('ViziteError sınıflandırması', () => {
    expect(new ViziteError('x', 105, '').isAuthError).toBe(true);
    expect(new ViziteError('x', 503, '').isEmpty).toBe(true);
    expect(new ViziteError('x', 1, '').isAuthError || new ViziteError('x', 1, '').isEmpty).toBe(false);
  });

  it('SGK tarih biçimi gidiş-dönüş', () => {
    expect(toSgkDate(new Date(2026, 0, 5))).toBe('05.01.2026');
    expect(parseSgkDate('05.01.2026')?.getMonth()).toBe(0);
    expect(parseSgkDate('2026-01-05T00:00:00Z')).toBeInstanceOf(Date);
    expect(parseSgkDate('')).toBeNull();
    expect(parseSgkDate('bozuk')).toBeNull();
  });
});
