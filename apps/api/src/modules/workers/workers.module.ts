import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { WorkerRecord, WorkerSchema } from './worker.schema';
import { WorkersController } from './workers.controller';
import { WorkersRepository } from './workers.repository';

@Module({
  imports: [MongooseModule.forFeature([{ name: WorkerRecord.name, schema: WorkerSchema }])],
  controllers: [WorkersController],
  providers: [WorkersRepository],
  exports: [WorkersRepository],
})
export class WorkersModule {}
