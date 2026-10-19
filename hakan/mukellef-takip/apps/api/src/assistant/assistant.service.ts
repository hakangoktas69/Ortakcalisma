import { HttpException, HttpStatus, Inject, Injectable, NotFoundException, ServiceUnavailableException } from '@nestjs/common';
import { PrismaService } from '../prisma.service.js';
import { AuditService } from '../audit.service.js';
import { redactPii } from './redact.js';
import { AssistantError, type AssistantProvider, type ChatTurn } from './assistant.providers.js';

export const ASSISTANT_PROVIDER = Symbol('ASSISTANT_PROVIDER');

/** Modele gönderilen en fazla geçmiş mesaj sayısı (maliyet ve bağlam sınırı) */
const HISTORY_LIMIT = 20;

export type AssistantEvent =
  | { event: 'meta'; data: { conversationId: string; userMessageId: string; question: string; redactions: Record<string, number> } }
  | { event: 'delta'; data: { text: string } }
  | { event: 'done'; data: { messageId: string; sources: { url: string; title: string }[] } }
  | { event: 'error'; data: { message: string } };

/** Ardışık aynı roldeki mesajları birleştirir (yarıda kalan bir yanıttan sonra iki kullanıcı mesajı art arda gelebilir). */
export function toChatTurns(rows: { role: 'USER' | 'ASSISTANT'; content: string }[]): ChatTurn[] {
  const turns: ChatTurn[] = [];
  for (const r of rows) {
    const role = r.role === 'USER' ? 'user' : 'assistant';
    const last = turns.at(-1);
    if (last && last.role === role) last.content += '\n\n' + r.content;
    else turns.push({ role, content: r.content });
  }
  while (turns.length && turns[0].role !== 'user') turns.shift();
  return turns;
}

function startOfToday() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

@Injectable()
export class AssistantService {
  readonly dailyLimit = Math.max(1, Number(process.env.ASSISTANT_DAILY_LIMIT) || 200);

  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    @Inject(ASSISTANT_PROVIDER) private readonly provider: AssistantProvider | null,
  ) {}

  // Kota denetim kaydından sayılır: sohbet silinse de kullanılan hak geri gelmez
  private usedToday(tenantId: string) {
    return this.prisma.auditLog.count({ where: { tenantId, action: 'assistant.ask', createdAt: { gte: startOfToday() } } });
  }

  async status(tenantId: string) {
    return {
      enabled: !!this.provider,
      mode: this.provider?.mode ?? 'off',
      model: this.provider?.model ?? null,
      webSearch: this.provider?.webSearch ?? false,
      dailyLimit: this.dailyLimit,
      usedToday: await this.usedToday(tenantId),
    };
  }

  conversations(userId: string) {
    return this.prisma.assistantConversation.findMany({
      where: { userId },
      orderBy: { updatedAt: 'desc' },
      take: 100,
      select: { id: true, title: true, updatedAt: true },
    });
  }

  async conversation(id: string, userId: string) {
    const c = await this.prisma.assistantConversation.findFirst({
      where: { id, userId },
      select: {
        id: true,
        title: true,
        messages: {
          orderBy: { createdAt: 'asc' },
          select: { id: true, role: true, content: true, redactions: true, sources: true, createdAt: true },
        },
      },
    });
    if (!c) throw new NotFoundException('Sohbet bulunamadı');
    return c;
  }

  async remove(id: string, userId: string) {
    const { count } = await this.prisma.assistantConversation.deleteMany({ where: { id, userId } });
    if (!count) throw new NotFoundException('Sohbet bulunamadı');
    return { ok: true };
  }

  /**
   * Akış başlamadan yapılan kontroller (hata HTTP durum koduyla dönebilsin diye ayrı):
   * asistan açık mı, günlük kota, sohbet kullanıcıya mı ait.
   */
  async prepare(user: { tenantId: string; sub: string }, input: { conversationId?: string; message: string }) {
    if (!this.provider) throw new ServiceUnavailableException('Asistan bu kurulumda kapalı');
    if ((await this.usedToday(user.tenantId)) >= this.dailyLimit)
      throw new HttpException(`Büronuzun günlük soru sınırı (${this.dailyLimit}) doldu. Yarın tekrar deneyin.`, HttpStatus.TOO_MANY_REQUESTS);
    if (input.conversationId) {
      const own = await this.prisma.assistantConversation.findFirst({ where: { id: input.conversationId, userId: user.sub }, select: { id: true } });
      if (!own) throw new NotFoundException('Sohbet bulunamadı');
    }
    return { user, ...input };
  }

  async run(ctx: Awaited<ReturnType<AssistantService['prepare']>>, emit: (e: AssistantEvent) => void, signal: AbortSignal) {
    const provider = this.provider!;
    const { text: question, redactions } = redactPii(ctx.message.trim());
    const conversationId =
      ctx.conversationId ??
      (
        await this.prisma.assistantConversation.create({
          data: { tenantId: ctx.user.tenantId, userId: ctx.user.sub, title: question.replace(/\s+/g, ' ').slice(0, 80) },
        })
      ).id;
    const userMessage = await this.prisma.assistantMessage.create({
      data: { conversationId, tenantId: ctx.user.tenantId, role: 'USER', content: question, redactions: Object.keys(redactions).length ? redactions : undefined },
    });
    // Denetim kaydına soru metni yazılmaz; sadece kim, hangi sohbet ve neyin gizlendiği
    await this.audit.log({ tenantId: ctx.user.tenantId, userId: ctx.user.sub, action: 'assistant.ask', target: conversationId, detail: { redactions } });
    emit({ event: 'meta', data: { conversationId, userMessageId: userMessage.id, question, redactions } });

    const rows = await this.prisma.assistantMessage.findMany({
      where: { conversationId },
      orderBy: { createdAt: 'desc' },
      take: HISTORY_LIMIT,
      select: { role: true, content: true },
    });
    const history = toChatTurns(rows.reverse());

    try {
      const answer = await provider.answer(history, (text) => emit({ event: 'delta', data: { text } }), signal);
      const saved = await this.prisma.assistantMessage.create({
        data: {
          conversationId,
          tenantId: ctx.user.tenantId,
          role: 'ASSISTANT',
          content: answer.text,
          sources: answer.sources.length ? answer.sources.map((s) => ({ url: s.url, title: s.title })) : undefined,
          model: answer.model,
          inputTokens: answer.inputTokens,
          outputTokens: answer.outputTokens,
        },
      });
      await this.prisma.assistantConversation.update({ where: { id: conversationId }, data: { updatedAt: new Date() } });
      emit({ event: 'done', data: { messageId: saved.id, sources: answer.sources } });
    } catch (e) {
      emit({ event: 'error', data: { message: e instanceof AssistantError ? e.message : 'Yanıt alınamadı. Lütfen tekrar deneyin.' } });
      if (!(e instanceof AssistantError)) throw e;
    }
  }
}
