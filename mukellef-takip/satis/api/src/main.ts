import 'dotenv/config';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { loadConfig } from './config.js';
import { configureApp } from './configure-app.js';

async function bootstrap() {
  // Ayarlar geçersiz ya da güvensizse süreç açılmaz
  const c = loadConfig();
  const { AppModule } = await import('./app.module.js');
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  app.enableShutdownHooks();
  configureApp(app, c);
  await app.listen(c.PORT);
}
await bootstrap();
