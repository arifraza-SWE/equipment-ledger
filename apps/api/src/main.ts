import 'reflect-metadata';
import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { IDEMPOTENCY_REPLAYED_HEADER } from '@equipment-ledger/shared';
import { AppModule } from './app.module';
import { loadEnvironment } from './config/environment';

async function bootstrap(): Promise<void> {
  const environment = loadEnvironment();
  const app = await NestFactory.create(AppModule.register({ mongoUri: environment.mongoUri }), {
    logger: ['log', 'warn', 'error'],
  });
  app.enableCors({ origin: environment.webOrigins, exposedHeaders: [IDEMPOTENCY_REPLAYED_HEADER] });
  app.enableShutdownHooks();
  await app.listen(environment.port);
  Logger.log(`Equipment ledger API listening on http://localhost:${environment.port}`, 'Bootstrap');
}

bootstrap().catch((error: unknown) => {
  Logger.error(error instanceof Error ? error.message : String(error), undefined, 'Bootstrap');
  process.exit(1);
});
