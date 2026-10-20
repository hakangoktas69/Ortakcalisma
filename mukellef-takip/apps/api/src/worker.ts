import 'dotenv/config';
import { NestFactory } from '@nestjs/core';
import { Logger } from 'nestjs-pino';
import { loadConfig } from './platform/config/config.js';

// Kuyruk ve zamanlayıcı süreci: HTTP dinlemez (docs/ai/architecture.md)
async function bootstrap() {
  loadConfig();
  const { WorkerModule } = await import('./worker.module.js');
  const app = await NestFactory.createApplicationContext(WorkerModule, { bufferLogs: true });
  app.useLogger(app.get(Logger));
  app.enableShutdownHooks();
  app.get(Logger).log('Worker hazır');
}
await bootstrap();
