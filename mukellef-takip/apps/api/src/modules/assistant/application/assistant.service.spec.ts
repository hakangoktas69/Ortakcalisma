import { describe, expect, it } from 'vitest';
import { toChatTurns } from './assistant.service.js';
import { MockAssistantProvider, systemPrompt } from '../infrastructure/assistant.providers.js';

describe('toChatTurns', () => {
  it('ardışık aynı rolü birleştirir, asistanla başlayan geçmişi kırpar', () => {
    expect(
      toChatTurns([
        { role: 'ASSISTANT', content: 'eski yanıt' },
        { role: 'USER', content: 'soru 1' },
        { role: 'USER', content: 'soru 2' },
        { role: 'ASSISTANT', content: 'yanıt' },
      ]),
    ).toEqual([
      { role: 'user', content: 'soru 1\n\nsoru 2' },
      { role: 'assistant', content: 'yanıt' },
    ]);
  });
});

describe('systemPrompt', () => {
  it('tarihi ve web erişimi durumunu içerir', () => {
    const p = systemPrompt(new Date('2026-10-13T09:00:00+03:00'), false);
    expect(p).toContain('13 Ekim 2026');
    expect(p).toContain('Web erişimin yok');
    expect(systemPrompt(new Date(), true)).toContain('web aramasını kullan');
  });
});

describe('MockAssistantProvider', () => {
  it('yanıtı parça parça akıtır ve iptal edilebilir', async () => {
    const parts: string[] = [];
    const a = await new MockAssistantProvider().answer([{ role: 'user', content: 'KDV ne zaman verilir?' }], (d) => parts.push(d), new AbortController().signal);
    expect(parts.join('')).toBe(a.text);
    expect(a.text).toContain('28. günü');

    const ac = new AbortController();
    ac.abort();
    await expect(new MockAssistantProvider().answer([{ role: 'user', content: 'x' }], () => {}, ac.signal)).rejects.toThrow('iptal');
  });
});
