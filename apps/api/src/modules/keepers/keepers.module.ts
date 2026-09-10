import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { KeeperRecord, KeeperSchema } from './keeper.schema';
import { KeepersController } from './keepers.controller';
import { KeepersRepository } from './keepers.repository';

@Module({
  imports: [MongooseModule.forFeature([{ name: KeeperRecord.name, schema: KeeperSchema }])],
  controllers: [KeepersController],
  providers: [KeepersRepository],
  exports: [KeepersRepository],
})
export class KeepersModule {}
