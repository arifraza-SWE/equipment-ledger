import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../app.module';
import { loadEnvironment } from '../config/environment';
import { resolveSeedAnchor } from './anchor';
import { seedStore } from './seed-store';

async function main(): Promise<void> {
  if (process.env.NODE_ENV === 'production') {
    throw new Error(
      'Refusing to seed: NODE_ENV is production and the seed replaces the whole store.',
    );
  }
  const environment = loadEnvironment();
  const anchor = resolveSeedAnchor(process.env.SEED_ANCHOR_DATE, new Date());
  const context = await NestFactory.createApplicationContext(
    AppModule.register({ mongoUri: environment.mongoUri }),
    {
      logger: ['warn', 'error'],
    },
  );
  try {
    const summary = await seedStore(context, anchor);
    console.log(`Seeded the store as of ${summary.anchor.slice(0, 10)}`);
    console.log(
      `  ${summary.assets} assets, ${summary.workers} workers, ${summary.keepers} keepers, ` +
        `${summary.movements} movements of which ${summary.corrections} corrected, ${summary.reservations} reservations`,
    );
    console.log(
      '  Demo assets: DRL-003 (issue), HARN-014 (concurrent issue), GAS-004 + WKR-007 (expired certificate),',
    );
    console.log(
      '               DRL-007 (backdated return), GRN-002 (corrected return), TWR-001 (reservation clash),',
    );
    console.log(
      '               GAS-002 (out of service), HARN-003 (overdue), GAS-001 two days ago 14:20 (as-of)',
    );
  } finally {
    await context.close();
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
