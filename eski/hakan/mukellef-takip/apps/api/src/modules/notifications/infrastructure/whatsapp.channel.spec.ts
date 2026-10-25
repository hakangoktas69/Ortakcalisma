import { afterEach, describe, expect, it, vi } from 'vitest';
import { WhatsappChannel, normalizePhone, templateParam } from './whatsapp.channel.js';

// WhatsApp kanalı: numara biçimi, şablon parametresi temizliği ve canlı/mock gönderim (Meta'ya gitmeden).

const ENV = { ...process.env };
afterEach(() => {
  process.env = { ...ENV };
  vi.unstubAllGlobals();
});

describe('normalizePhone', () => {
  it.each([
    ['0532 123 45 67', '905321234567'],
    ['+90 (532) 123-4567', '905321234567'],
    ['5321234567', '905321234567'],
    ['905321234567', '905321234567'],
  ])('%s → %s', (input, out) => expect(normalizePhone(input)).toBe(out));

  it.each(['123', '02121234567', '+44 7700 900123', ''])('geçersiz: %s', (input) => expect(normalizePhone(input)).toBeNull());
});

describe('templateParam', () => {
  it('satır sonlarını ve fazla boşluğu temizler, sınırlar, boşsa tire', () => {
    expect(templateParam('a\n\tb   c')).toBe('a b c');
    expect(templateParam('x'.repeat(600))).toHaveLength(500);
    expect(templateParam('   ')).toBe('-');
  });
});

describe('WhatsappChannel', () => {
  it('kapalı modda gönderim reddedilir, mock modda kayıt kimliği döner', async () => {
    process.env.WHATSAPP_MODE = 'off';
    await expect(new WhatsappChannel().send('905321234567', 'Başlık', 'Metin')).rejects.toThrow();
    process.env.WHATSAPP_MODE = 'mock';
    const r = await new WhatsappChannel().send('905321234567', 'Başlık', 'Metin');
    expect(r.providerMessageId).toMatch(/^demo\./);
  });

  it('canlı modda onaylı şablonla Graph API\'ye gider; hata anlaşılır döner', async () => {
    Object.assign(process.env, { WHATSAPP_MODE: 'live', WHATSAPP_PHONE_NUMBER_ID: '111', WHATSAPP_ACCESS_TOKEN: 'tok', WHATSAPP_GRAPH_VERSION: 'v99.0', WHATSAPP_TEMPLATE: 'mukellef_bildirim' });
    const seen: { url: string; body: Record<string, unknown>; auth: string }[] = [];
    vi.stubGlobal('fetch', async (url: string, init: RequestInit) => {
      seen.push({ url, body: JSON.parse(String(init.body)), auth: String((init.headers as Record<string, string>).Authorization) });
      return new Response(JSON.stringify({ messages: [{ id: 'wamid.1' }] }), { status: 200 });
    });
    const ch = new WhatsappChannel();
    expect(ch.configured).toBe(true);
    const r = await ch.send('905321234567', 'e-Tebligat', '2 yeni e-tebligat');
    expect(r.providerMessageId).toBe('wamid.1');
    expect(seen[0].url).toContain('/v99.0/111/messages');
    expect(seen[0].auth).toBe('Bearer tok');
    expect(JSON.stringify(seen[0].body)).toContain('mukellef_bildirim');

    vi.stubGlobal('fetch', async () => new Response(JSON.stringify({ error: { message: 'Template not approved' } }), { status: 400 }));
    await expect(ch.send('905321234567', 'a', 'b')).rejects.toThrow(/Template not approved|400/);
  });
});
