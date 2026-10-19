import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { AnthropicAssistantProvider, OFFICIAL_DOMAINS } from './assistant.providers.js';

// Anthropic Messages API akış biçimini taklit eden yerel sunucu: gerçek anahtar ve ağ olmadan
// istek gövdesini, "pause_turn" devamını, kaynak (citation) toplamayı ve hata eşlemesini doğrular.
type Reply = { status?: number; text: string; stop: string; citation?: { url: string; title: string } };
let replies: Reply[] = [];
const bodies: Record<string, unknown>[] = [];
let server: Server;

const sse = (type: string, data: object) => `event: ${type}\ndata: ${JSON.stringify({ type, ...data })}\n\n`;

beforeAll(async () => {
  server = createServer((req, res) => {
    let raw = '';
    req.on('data', (c) => (raw += c));
    req.on('end', () => {
      bodies.push(JSON.parse(raw));
      const r = replies.shift()!;
      if (r.status) {
        res.writeHead(r.status, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({ type: 'error', error: { type: 'overloaded_error', message: 'x' } }));
      }
      res.writeHead(200, { 'Content-Type': 'text/event-stream' });
      res.write(
        sse('message_start', {
          message: { id: 'msg_1', type: 'message', role: 'assistant', model: 'm', content: [], stop_reason: null, stop_sequence: null, usage: { input_tokens: 10, output_tokens: 1 } },
        }),
      );
      res.write(sse('content_block_start', { index: 0, content_block: { type: 'text', text: '', citations: null } }));
      for (const part of r.text.match(/.{1,5}/g)!) res.write(sse('content_block_delta', { index: 0, delta: { type: 'text_delta', text: part } }));
      if (r.citation)
        res.write(
          sse('content_block_delta', {
            index: 0,
            delta: { type: 'citations_delta', citation: { type: 'web_search_result_location', ...r.citation, cited_text: '…', encrypted_index: 'e' } },
          }),
        );
      res.write(sse('content_block_stop', { index: 0 }));
      res.write(sse('message_delta', { delta: { stop_reason: r.stop, stop_sequence: null }, usage: { output_tokens: 7 } }));
      res.write(sse('message_stop', {}));
      res.end();
    });
  });
  await new Promise<void>((ok) => server.listen(0, '127.0.0.1', ok));
  process.env.ANTHROPIC_BASE_URL = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  process.env.ANTHROPIC_API_KEY = 'test-anahtari';
});

afterAll(() => {
  server.close();
  delete process.env.ANTHROPIC_BASE_URL;
  delete process.env.ANTHROPIC_API_KEY;
});

beforeEach(() => {
  replies = [];
  bodies.length = 0;
});

describe('AnthropicAssistantProvider', () => {
  it('yanıtı akıtır, sistem istemini önbelleğe işaretler, web aramasında resmi alan adlarıyla sınırlar', async () => {
    replies = [{ text: 'KDV beyannamesi 28. gün verilir.', stop: 'end_turn', citation: { url: 'https://www.gib.gov.tr/kdv', title: 'GİB KDV' } }];
    const deltas: string[] = [];
    const p = new AnthropicAssistantProvider('claude-opus-5-5', true);
    const a = await p.answer([{ role: 'user', content: 'KDV?' }], (d) => deltas.push(d), new AbortController().signal);

    expect(deltas.join('')).toBe('KDV beyannamesi 28. gün verilir.');
    expect(a.text).toBe(deltas.join(''));
    expect(a.sources).toEqual([{ url: 'https://www.gib.gov.tr/kdv', title: 'GİB KDV' }]);
    expect(a.outputTokens).toBe(7);

    const body = bodies[0] as { model: string; system: { cache_control: unknown }[]; tools: { type: string; allowed_domains: string[] }[]; stream: boolean };
    expect(body.model).toBe('claude-opus-5-5');
    expect(body.stream).toBe(true);
    expect(body.system[0].cache_control).toEqual({ type: 'ephemeral' });
    expect(body.tools[0].type).toBe('web_search_20260318');
    expect(body.tools[0].allowed_domains).toEqual(OFFICIAL_DOMAINS);
  });

  it('web araması kapalıyken araç göndermez; pause_turn gelirse kaldığı yerden devam eder', async () => {
    replies = [
      { text: 'Bakıyorum. ', stop: 'pause_turn' },
      { text: 'Sonuç hazır.', stop: 'end_turn' },
    ];
    const a = await new AnthropicAssistantProvider('claude-sonnet-5-5', false).answer([{ role: 'user', content: 'soru' }], () => {}, new AbortController().signal);
    expect(a.text).toBe('Bakıyorum. Sonuç hazır.');
    expect(bodies).toHaveLength(2);
    expect(bodies[0].tools).toBeUndefined();
    const second = bodies[1] as { messages: { role: string }[] };
    expect(second.messages.map((m) => m.role)).toEqual(['user', 'assistant']);
  });

  it('servis hatasını kullanıcıya uygun Türkçe mesaja çevirir', async () => {
    replies = [{ status: 529, text: '', stop: '' }, { status: 529, text: '', stop: '' }, { status: 529, text: '', stop: '' }];
    const p = new AnthropicAssistantProvider('m', false);
    await expect(p.answer([{ role: 'user', content: 'x' }], () => {}, new AbortController().signal)).rejects.toThrow('geçici olarak yanıt vermiyor');
  }, 30_000);
});
