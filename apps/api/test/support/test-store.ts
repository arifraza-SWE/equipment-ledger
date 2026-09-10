import { type INestApplication, ValidationPipe } from '@nestjs/common';
import { getConnectionToken } from '@nestjs/mongoose';
import { Test } from '@nestjs/testing';
import { IDEMPOTENCY_KEY_HEADER } from '@equipment-ledger/shared';
import type { Connection } from 'mongoose';
import { randomUUID } from 'node:crypto';
import request from 'supertest';
import type TestAgent from 'supertest/lib/agent';
import { AppModule } from '../../src/app.module';
import { CLOCK } from '../../src/common/time/clock';
import { seedStore } from '../../src/seed/seed-store';
import { FakeClock } from './fake-clock';

export const SEED_ANCHOR = new Date('2026-09-10T00:00:00Z');
export const TEST_NOW = new Date('2026-09-10T12:00:00Z');

export interface TestStore {
  app: INestApplication;
  http: TestAgent;
  clock: FakeClock;
  connection: Connection;
  reseed(): Promise<void>;
  close(): Promise<void>;
}

export async function openTestStore(): Promise<TestStore> {
  const mongoUri = process.env.MONGODB_TEST_URI;
  if (!mongoUri) {
    throw new Error('MONGODB_TEST_URI is not set');
  }
  const clock = new FakeClock(TEST_NOW);
  const moduleRef = await Test.createTestingModule({ imports: [AppModule.register({ mongoUri })] })
    .overrideProvider(CLOCK)
    .useValue(clock)
    .compile();

  const app = moduleRef.createNestApplication({ logger: ['error'] });
  app.useGlobalPipes(
    new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }),
  );
  await app.listen(0, '127.0.0.1');
  const baseUrl = await app.getUrl();
  const connection = app.get<Connection>(getConnectionToken());

  const store: TestStore = {
    app,
    http: request(baseUrl),
    clock,
    connection,
    async reseed() {
      clock.set(TEST_NOW);
      await seedStore(app, SEED_ANCHOR);
    },
    async close() {
      await app.close();
    },
  };
  await store.reseed();
  return store;
}

export function idempotencyKey(): string {
  return randomUUID();
}

export function withKey(key: string = idempotencyKey()): Record<string, string> {
  return { [IDEMPOTENCY_KEY_HEADER]: key };
}

export function instant(dayOffsetFromAnchor: number, clockTime: string): string {
  const [hoursPart, minutesPart] = clockTime.split(':');
  const millis =
    SEED_ANCHOR.getTime() +
    dayOffsetFromAnchor * 86_400_000 +
    (Number(hoursPart) * 60 + Number(minutesPart)) * 60_000;
  return new Date(millis).toISOString();
}
