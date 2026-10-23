import { ValidationPipe } from '@nestjs/common';
import type { NestExpressApplication } from '@nestjs/platform-express';
import helmet from 'helmet';
import type { SatisConfig } from './config.js';
import { PrismaExceptionFilter } from './core.js';
import { csrfGuard } from './interface/http/session.js';

/** HTTP güvenlik ve istek ayarları (main.ts ve e2e testleri aynı kurulumu kullanır). */
export function configureApp(app: NestExpressApplication, c: SatisConfig) {
  if (c.TRUST_PROXY_HOPS > 0) app.set('trust proxy', c.TRUST_PROXY_HOPS);
  app.disable('x-powered-by');
  app.use(
    helmet({
      contentSecurityPolicy: { directives: { defaultSrc: ["'none'"], frameAncestors: ["'none'"] } },
      crossOriginResourcePolicy: { policy: 'same-origin' },
    }),
  );
  // CORS açılmaz: satış ekranı aynı kökenden (ters vekil) ya da geliştirmede Next yönlendirmesiyle çağırır
  app.use(csrfGuard);
  app.useBodyParser('json', { limit: '100kb' });
  app.setGlobalPrefix('api/satis');
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true }));
  app.useGlobalFilters(new PrismaExceptionFilter());
}
