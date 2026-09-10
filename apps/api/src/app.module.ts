import { type DynamicModule, Module, ValidationPipe } from '@nestjs/common';
import { APP_FILTER, APP_PIPE } from '@nestjs/core';
import { ApiExceptionFilter } from './common/errors/api-exception.filter';
import { IdempotencyModule } from './common/idempotency/idempotency.module';
import { ClockModule } from './common/time/clock.module';
import { DatabaseModule } from './database/database.module';
import { HealthController } from './health.controller';
import { AssetsModule } from './modules/assets/assets.module';
import { KeepersModule } from './modules/keepers/keepers.module';
import { LedgerModule } from './modules/ledger/ledger.module';
import { MovementsModule } from './modules/movements/movements.module';
import { ReservationsModule } from './modules/reservations/reservations.module';
import { WorkersModule } from './modules/workers/workers.module';

export interface AppModuleOptions {
  mongoUri: string;
}

@Module({})
export class AppModule {
  static register(options: AppModuleOptions): DynamicModule {
    return {
      module: AppModule,
      imports: [
        DatabaseModule.forRoot(options.mongoUri),
        ClockModule,
        IdempotencyModule,
        AssetsModule,
        WorkersModule,
        KeepersModule,
        LedgerModule,
        MovementsModule,
        ReservationsModule,
      ],
      controllers: [HealthController],
      providers: [
        { provide: APP_FILTER, useClass: ApiExceptionFilter },
        {
          provide: APP_PIPE,
          useValue: new ValidationPipe({
            whitelist: true,
            forbidNonWhitelisted: true,
            transform: true,
            stopAtFirstError: false,
          }),
        },
      ],
    };
  }
}
