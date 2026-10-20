import { ValidationPipe } from '@nestjs/common';
import type { NestExpressApplication } from '@nestjs/platform-express';
import helmet from 'helmet';
import type { AppConfig } from '../config/config.js';
import { runWithDbContext } from '../database/tenant-context.js';

/** HTTP uygulamasının güvenlik ve istek ayarları (main.ts ve e2e testleri aynı kurulumu kullanır). */
export function configureApp(app: NestExpressApplication, config: AppConfig) {
  // Ters vekil (Caddy) arkasında istemci IP'si hız sınırı için X-Forwarded-For'dan alınır
  if (config.TRUST_PROXY_HOPS > 0) app.set('trust proxy', config.TRUST_PROXY_HOPS);
  app.disable('x-powered-by');
  // API yalnız JSON döner: içerik güvenlik politikası en kısıtlı hâliyle
  app.use(
    helmet({
      contentSecurityPolicy: { directives: { defaultSrc: ["'none'"], frameAncestors: ["'none'"] } },
      crossOriginResourcePolicy: { policy: 'same-site' },
    }),
  );
  // Her istek kendi veritabanı bağlamında (RLS): AuthGuard büroyu bu bağlama yazar
  app.use((_req: unknown, _res: unknown, next: () => void) => runWithDbContext(next));

  // Eklenti bir sayfadaki tabloların tamamını gönderebilir
  app.useBodyParser('json', { limit: '2mb' });
  app.setGlobalPrefix('api');
  app.enableCors({
    origin: [config.WEB_ORIGIN, config.EXTENSION_ID ? `chrome-extension://${config.EXTENSION_ID}` : /^chrome-extension:\/\/[a-p]{32}$/],
  });
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true }));
}
