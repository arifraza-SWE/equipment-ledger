import { Module } from '@nestjs/common';
import { AssetsModule } from '../assets/assets.module';
import { KeepersModule } from '../keepers/keepers.module';
import { WorkersModule } from '../workers/workers.module';
import { AssetHistoryService } from './asset-history.service';
import { AssetsQueryController } from './assets-query.controller';
import { LedgerMovementsQuery } from './ledger-movements.query';
import { LedgerController } from './ledger.controller';
import { MovementNamesService } from './movement-names.service';
import { LedgerPersistenceModule } from './persistence/ledger-persistence.module';
import { StoreSnapshotService } from './store-snapshot.service';
import { WorkerDetailController } from './worker-detail.controller';
import { WorkerDetailService } from './worker-detail.service';

@Module({
  imports: [LedgerPersistenceModule, AssetsModule, WorkersModule, KeepersModule],
  controllers: [LedgerController, AssetsQueryController, WorkerDetailController],
  providers: [
    StoreSnapshotService,
    AssetHistoryService,
    WorkerDetailService,
    MovementNamesService,
    LedgerMovementsQuery,
  ],
  exports: [LedgerPersistenceModule, StoreSnapshotService, MovementNamesService],
})
export class LedgerModule {}
