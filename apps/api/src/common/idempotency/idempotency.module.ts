import { Global, Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { IdempotencyRecord, IdempotencyRecordSchema } from './idempotency-record.schema';
import { IdempotencyInterceptor } from './idempotency.interceptor';
import { IdempotencyService } from './idempotency.service';

@Global()
@Module({
  imports: [
    MongooseModule.forFeature([{ name: IdempotencyRecord.name, schema: IdempotencyRecordSchema }]),
  ],
  providers: [IdempotencyService, IdempotencyInterceptor],
  exports: [IdempotencyService, IdempotencyInterceptor],
})
export class IdempotencyModule {}
