import { Injectable, Logger } from '@nestjs/common';

// WhatsApp Business Cloud API (Meta) kanalı.
//
// İşletmenin başlattığı mesajlar sadece Meta'da ONAYLANMIŞ bir şablonla gönderilebilir. Beklenen şablon
// (WHATSAPP_TEMPLATE, dil "tr", kategori "Utility"):
//     Mükellef Takip bildirimi: {{1}} — {{2}}
// {{1}} başlık, {{2}} ayrıntıdır. Alıcının açık rızası (opt-in) olmadan gönderim yapılmaz; rıza
// kullanıcı ayarlarında alınır ve tarihiyle saklanır.
//
// WHATSAPP_MODE: off (gönderim yok) | mock (gönderilmiş gibi kaydedilir, sadece log) | live (gerçek gönderim)

export type WhatsappMode = 'off' | 'mock' | 'live';

export interface WhatsappSendResult {
  providerMessageId: string;
}

export class WhatsappError extends Error {}

/** Türkiye numaralarını E.164 biçimine (başında + olmadan) çevirir: "0532 123 45 67" → "905321234567". */
export function normalizePhone(raw: string): string | null {
  let d = raw.replace(/\D/g, '');
  if (d.startsWith('00')) d = d.slice(2);
  if (d.length === 10 && d.startsWith('5')) d = '90' + d;
  if (d.length === 11 && d.startsWith('05')) d = '9' + d;
  return /^905\d{9}$/.test(d) ? d : null;
}

/** Şablon parametreleri satır sonu, sekme ve 4'ten fazla ardışık boşluk içeremez; uzunluk da sınırlıdır. */
export function templateParam(s: string, max = 500): string {
  return s.replace(/[\r\n\t]+/g, ' ').replace(/ {2,}/g, ' ').trim().slice(0, max) || '-';
}

@Injectable()
export class WhatsappChannel {
  private readonly logger = new Logger(WhatsappChannel.name);
  readonly mode: WhatsappMode = (['off', 'mock', 'live'] as const).includes(process.env.WHATSAPP_MODE as WhatsappMode)
    ? (process.env.WHATSAPP_MODE as WhatsappMode)
    : 'off';

  private get config() {
    return {
      version: process.env.WHATSAPP_GRAPH_VERSION,
      phoneNumberId: process.env.WHATSAPP_PHONE_NUMBER_ID,
      token: process.env.WHATSAPP_ACCESS_TOKEN,
      template: process.env.WHATSAPP_TEMPLATE ?? 'mukellef_bildirim',
    };
  }

  /** Canlı modda gerekli ayarların hepsi var mı? */
  get configured(): boolean {
    if (this.mode !== 'live') return this.mode === 'mock';
    const c = this.config;
    return !!(c.version && c.phoneNumberId && c.token);
  }

  async send(to: string, title: string, body: string): Promise<WhatsappSendResult> {
    if (this.mode === 'off') throw new WhatsappError('WhatsApp kanalı kapalı');
    if (this.mode === 'mock') {
      this.logger.log(`[demo] WhatsApp → ${to.slice(0, 5)}*****${to.slice(-2)}: ${templateParam(title)} — ${templateParam(body)}`);
      return { providerMessageId: `demo.${Date.now()}.${Math.random().toString(36).slice(2, 8)}` };
    }

    const c = this.config;
    if (!this.configured) throw new WhatsappError('WhatsApp canlı ayarları eksik (WHATSAPP_GRAPH_VERSION, WHATSAPP_PHONE_NUMBER_ID, WHATSAPP_ACCESS_TOKEN)');
    const res = await fetch(`https://graph.facebook.com/${c.version}/${c.phoneNumberId}/messages`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${c.token}` },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        to,
        type: 'template',
        template: {
          name: c.template,
          language: { code: 'tr' },
          components: [
            {
              type: 'body',
              parameters: [
                { type: 'text', text: templateParam(title, 120) },
                { type: 'text', text: templateParam(body) },
              ],
            },
          ],
        },
      }),
      signal: AbortSignal.timeout(20_000),
    });
    const json = (await res.json().catch(() => ({}))) as { messages?: { id: string }[]; error?: { message?: string; code?: number } };
    if (!res.ok || !json.messages?.[0]?.id) {
      throw new WhatsappError(`WhatsApp API: ${json.error?.message ?? `HTTP ${res.status}`}${json.error?.code ? ` (kod ${json.error.code})` : ''}`);
    }
    return { providerMessageId: json.messages[0].id };
  }
}
