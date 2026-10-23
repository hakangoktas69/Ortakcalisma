import 'dotenv/config';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { Logger } from 'nestjs-pino';
import { loadConfig } from './platform/config/config.js';
import { configureApp } from './platform/http/configure-app.js';

async function bootstrap() {
  // Ayarlar geçersiz ya da güvensizse süreç açılmaz (platform/config)
  const config = loadConfig();
  const { AppModule } = await import('./app.module.js');
  const app = await NestFactory.create<NestExpressApplication>(AppModule, { bufferLogs: true });
  app.useLogger(app.get(Logger));
  app.enableShutdownHooks();
  configureApp(app, config);
  await app.listen(config.PORT);
}
await bootstrap();
