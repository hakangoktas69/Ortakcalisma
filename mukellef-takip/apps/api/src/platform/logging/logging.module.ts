import { randomUUID } from 'node:crypto';
import type { IncomingMessage } from 'node:http';
import { Module } from '@nestjs/common';
import { LoggerModule } from 'nestjs-pino';
import { redactPii } from '../../shared-kernel/pii-redact.js';

/** Yapılandırılmış log alanlarında hiç yazılmayacak (sansürlenecek) yollar. */
export const REDACT_PATHS = [
  'req.headers.authorization',
  'req.headers.cookie',
  'res.headers["set-cookie"]',
  '*.password',
  '*.newPassword',
  '*.currentPassword',
  '*.token',
  '*.accessToken',
  '*.refreshToken',
  '*.mfaToken',
  '*.secret',
  '*.systemPassword',
  '*.workplacePassword',
];

/** Log mesajı metinlerinde TCKN, VKN, IBAN, telefon, e-posta, sicil no maskelenir (shared-kernel/pii-redact). */
export function scrubMessage(arg: unknown): unknown {
  return typeof arg === 'string' ? redactPii(arg).text : arg;
}

/**
 * Yapılandırılmış JSON log (pino). İstek kimliği her satırda; gövde ve sorgu dizesi loglanmaz
 * (kişisel veri içerebilir). Geliştirmede okunur biçim için LOG_PRETTY=true.
 */
@Module({
  imports: [
    LoggerModule.forRoot({
      pinoHttp: {
        level: process.env.LOG_LEVEL ?? 'info',
        redact: { paths: REDACT_PATHS, censor: '[gizli]' },
        genReqId: (req: IncomingMessage) => (req.headers['x-request-id'] as string | undefined)?.slice(0, 64) || randomUUID(),
        serializers: {
          // Yol + metot; sorgu dizesi (ör. ?q=<TCKN>) ve gövde yazılmaz
          req: (req: { id: string; method: string; url: string }) => ({ id: req.id, method: req.method, path: req.url.split('?')[0] }),
          res: (res: { statusCode: number }) => ({ statusCode: res.statusCode }),
        },
        hooks: {
          logMethod(args, method) {
            method.apply(this, args.map(scrubMessage) as Parameters<typeof method>);
          },
        },
        autoLogging: { ignore: (req: IncomingMessage) => req.url === '/api/health' },
        ...(process.env.LOG_PRETTY === 'true' ? { transport: { target: 'pino-pretty', options: { singleLine: true } } } : {}),
      },
    }),
  ],
})
export class LoggingModule {}
