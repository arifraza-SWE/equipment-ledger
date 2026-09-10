import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { AssetRecord, AssetSchema } from './asset.schema';
import { AssetsRepository } from './assets.repository';

@Module({
  imports: [MongooseModule.forFeature([{ name: AssetRecord.name, schema: AssetSchema }])],
  providers: [AssetsRepository],
  exports: [AssetsRepository],
})
export class AssetsModule {}
