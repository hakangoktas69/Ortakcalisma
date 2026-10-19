import Anthropic from '@anthropic-ai/sdk';

export interface ChatTurn {
  role: 'user' | 'assistant';
  content: string;
}

export interface AssistantSource {
  url: string;
  title: string;
}

export interface AssistantAnswer {
  text: string;
  sources: AssistantSource[];
  model: string;
  inputTokens: number | null;
  outputTokens: number | null;
}

export interface AssistantProvider {
  readonly mode: 'mock' | 'anthropic';
  readonly model: string;
  readonly webSearch: boolean;
  answer(history: ChatTurn[], onText: (delta: string) => void, signal: AbortSignal): Promise<AssistantAnswer>;
}

/** Web aramasına izin verilen resmi kaynaklar */
export const OFFICIAL_DOMAINS = ['gib.gov.tr', 'sgk.gov.tr', 'mevzuat.gov.tr', 'resmigazete.gov.tr', 'csgb.gov.tr', 'turmob.org.tr'];

export function systemPrompt(now = new Date(), webSearch = false) {
  const today = now.toLocaleDateString('tr-TR', { day: '2-digit', month: 'long', year: 'numeric', timeZone: 'Europe/Istanbul' });
  return `Sen "Mükellef Takip" portalındaki "Uzmana Sor" asistanısın. Kullanıcıların mali müşavirler ve büro personelidir.
Bugünün tarihi: ${today}.

Görevin: Türk vergi ve sosyal güvenlik mevzuatı hakkında genel sorulara doğru, kısa ve kaynak gösteren yanıtlar vermek.
Kapsam: 213 VUK, 193 GVK, 5520 KVK, 3065 KDVK, 488 Damga Vergisi, 6183, 5510, 4857 İş Kanunu, e-Beyanname, e-Defter,
e-Fatura/e-Arşiv, e-Tebligat, SGK bildirgeleri (APHB/MUHSGK, işe giriş-çıkış, e-Bildirge, Vizite), teşvikler, beyanname süreleri.

Kurallar:
- Türkçe yanıt ver. Önce doğrudan cevap, sonra gerekiyorsa kısa açıklama. Gereksiz uzatma.
- Dayanak göster: kanun adı/numarası ve madde, tebliğ, genelge veya sirküler. Emin olmadığın dayanağı uydurma; "emin değilim" de.
- Oranlar, tutarlar, had ve sınırlar (asgari ücret, tavan/taban, istisna tutarları, gecikme zammı, ceza tutarları vb.) her yıl
  değişir. Bu tür rakamları verirken hangi yıl/dönem için geçerli olduğunu yaz ve güncel değerin GİB, SGK veya Resmî Gazete'den
  doğrulanmasını hatırlat.${webSearch ? '\n- Güncel rakam veya yeni düzenleme gerektiğinde web aramasını kullan; sadece resmi kaynaklara (GİB, SGK, Mevzuat, Resmî Gazete) dayan ve kaynağı belirt.' : '\n- Web erişimin yok; bilgin belirli bir tarihe kadar günceldir. Yeni bir düzenleme olabileceğini gerektiğinde belirt.'}
- Mükellefe özel kişisel veri isteme ve işleme. Metindeki [TCKN], [VKN], [IBAN], [SİCİL NO], [TELEFON], [E-POSTA] ifadeleri
  portal tarafından gizlenmiş bilgilerdir; gerçek değerlerini tahmin etmeye çalışma, soruyu genel hâliyle yanıtla.
- Bu portalın verilerine (firmalar, beyannameler, SGK kayıtları) erişimin yok. Kullanıcı "benim firmam" gibi sorarsa genel kuralı anlat.
- Kesin hukuki görüş veya yargı kararı yerine geçecek ifadeler kullanma. Tartışmalı ya da riskli konularda (ceza, uzlaşma,
  pişmanlık, inceleme) bir uzmana veya ilgili kuruma danışılmasını öner.
- Biçim: kısa paragraflar, gerektiğinde madde işaretli liste ve **kalın** vurgu. Tablo ve başlık kullanma.`;
}

function anthropicErrorMessage(e: unknown): string {
  if (e instanceof Anthropic.APIError) {
    if (e.status === 401 || e.status === 403) return 'Yapay zekâ servisi anahtarı geçersiz. Yöneticinize bildirin.';
    if (e.status === 429) return 'Yapay zekâ servisi şu an çok yoğun. Biraz sonra tekrar deneyin.';
    if (e.status === 529 || (e.status ?? 0) >= 500) return 'Yapay zekâ servisi geçici olarak yanıt vermiyor. Biraz sonra tekrar deneyin.';
    if (e.status === 400) return 'Soru işlenemedi. Daha kısa bir soruyla tekrar deneyin.';
  }
  return 'Yanıt alınamadı. Lütfen tekrar deneyin.';
}

export class AnthropicAssistantProvider implements AssistantProvider {
  readonly mode = 'anthropic' as const;
  private readonly client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

  constructor(
    readonly model = process.env.ASSISTANT_MODEL || 'claude-opus-5-5',
    readonly webSearch = process.env.ASSISTANT_WEB_SEARCH === 'on',
  ) {}

  async answer(history: ChatTurn[], onText: (delta: string) => void, signal: AbortSignal): Promise<AssistantAnswer> {
    const messages: Anthropic.MessageParam[] = history.map((t) => ({ role: t.role, content: t.content }));
    let text = '';
    let inputTokens = 0;
    let outputTokens = 0;
    const sources = new Map<string, AssistantSource>();
    try {
      // Web araması sunucu tarafında uzun sürerse yanıt "pause_turn" ile yarıda döner; kaldığı yerden devam ettirilir.
      for (let round = 0; round < 3; round++) {
        const stream = this.client.messages.stream(
          {
            model: this.model,
            max_tokens: 4096,
            system: [{ type: 'text', text: systemPrompt(new Date(), this.webSearch), cache_control: { type: 'ephemeral' } }],
            messages,
            ...(this.webSearch
              ? { tools: [{ type: 'web_search_20260318', name: 'web_search', max_uses: 3, allowed_domains: OFFICIAL_DOMAINS }] }
              : {}),
          },
          { signal },
        );
        stream.on('text', (delta) => {
          text += delta;
          onText(delta);
        });
        const final = await stream.finalMessage();
        inputTokens += final.usage.input_tokens + (final.usage.cache_read_input_tokens ?? 0) + (final.usage.cache_creation_input_tokens ?? 0);
        outputTokens += final.usage.output_tokens;
        for (const block of final.content) {
          if (block.type !== 'text') continue;
          for (const c of block.citations ?? []) {
            if (c.type === 'web_search_result_location') sources.set(c.url, { url: c.url, title: c.title ?? c.url });
          }
        }
        if (final.stop_reason !== 'pause_turn') break;
        messages.push({ role: 'assistant', content: final.content });
      }
    } catch (e) {
      if (signal.aborted) throw new AssistantError('İstek iptal edildi.');
      throw new AssistantError(anthropicErrorMessage(e));
    }
    return { text, sources: [...sources.values()].slice(0, 8), model: this.model, inputTokens, outputTokens };
  }
}

export class AssistantError extends Error {}

const DEMO_ANSWERS: { match: RegExp; text: string }[] = [
  {
    match: /kdv/i,
    text:
      '**Aylık KDV beyannamesi**, vergilendirme dönemini izleyen ayın **28. günü** sonuna kadar verilir ve aynı sürede ödenir ' +
      '(3065 sayılı KDV Kanunu md. 41 ve 46; süreler KDV Genel Uygulama Tebliği ile düzenlenmiştir).\n\n' +
      '- Son gün resmi tatile denk gelirse süre izleyen ilk iş gününe uzar (213 VUK md. 18).\n' +
      '- Süre uzatımları GİB duyurularıyla yapılabilir; güncel durumu gib.gov.tr üzerinden kontrol edin.',
  },
  {
    match: /muhtasar|aphb|prim hizmet/i,
    text:
      '**Muhtasar ve Prim Hizmet Beyannamesi** aylık olarak, izleyen ayın **26. günü** sonuna kadar verilir ' +
      '(193 GVK md. 98, 5510 sayılı Kanun md. 86).\n\n' +
      '- Prim ödemesi de aynı ayın sonuna kadar yapılır.\n' +
      '- Geç verilmesi hâlinde hem VUK md. 352 usulsüzlük cezası hem de 5510 md. 102 idari para cezası gündeme gelebilir.',
  },
];

/** Anahtar yokken / demo modunda: gerçek bir yapay zekâ çağrısı yapmaz, hazır yanıtı parça parça akıtır. */
export class MockAssistantProvider implements AssistantProvider {
  readonly mode = 'mock' as const;
  readonly model = 'demo';
  readonly webSearch = false;

  async answer(history: ChatTurn[], onText: (delta: string) => void, signal: AbortSignal): Promise<AssistantAnswer> {
    const question = history.at(-1)?.content ?? '';
    const found = DEMO_ANSWERS.find((a) => a.match.test(question));
    const text =
      (found?.text ??
        'Bu bir **demo yanıtıdır**: yapay zekâ servisi henüz bağlanmadı.\n\n' +
          'Gerçek yanıtlar için yöneticinin API ayarlarında `ANTHROPIC_API_KEY` tanımlaması gerekir. ' +
          'Demo modunda örnek olarak KDV veya muhtasar beyannamesi hakkında soru sorabilirsiniz.') + '\n\n_(Demo yanıt)_';
    for (const part of text.match(/\S+\s*/g) ?? []) {
      if (signal.aborted) throw new AssistantError('İstek iptal edildi.');
      onText(part);
      await new Promise((r) => setTimeout(r, 15));
    }
    return { text, sources: [], model: this.model, inputTokens: null, outputTokens: null };
  }
}

export function createAssistantProvider(): AssistantProvider | null {
  const mode = process.env.ASSISTANT_MODE || (process.env.ANTHROPIC_API_KEY ? 'anthropic' : 'mock');
  if (mode === 'off') return null;
  if (mode === 'anthropic' && process.env.ANTHROPIC_API_KEY) return new AnthropicAssistantProvider();
  return new MockAssistantProvider();
}
