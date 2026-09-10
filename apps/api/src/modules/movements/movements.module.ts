import { Module } from '@nestjs/common';
import { AssetsModule } from '../assets/assets.module';
import { KeepersModule } from '../keepers/keepers.module';
import { LedgerModule } from '../ledger/ledger.module';
import { WorkersModule } from '../workers/workers.module';
import { AssetServiceStatusController } from './asset-service-status.controller';
import { ChangeServiceStatusUseCase } from './change-service-status.use-case';
import { CorrectMovementUseCase } from './correct-movement.use-case';
import { IssueAssetUseCase } from './issue-asset.use-case';
import { LedgerParties } from './ledger-parties';
import { MovementsController } from './movements.controller';
import { ReturnAssetUseCase } from './return-asset.use-case';
import { ServiceWithdrawalRecorder } from './service-withdrawal.recorder';

@Module({
  imports: [LedgerModule, AssetsModule, WorkersModule, KeepersModule],
  controllers: [MovementsController, AssetServiceStatusController],
  providers: [
    LedgerParties,
    ServiceWithdrawalRecorder,
    IssueAssetUseCase,
    ReturnAssetUseCase,
    CorrectMovementUseCase,
    ChangeServiceStatusUseCase,
  ],
  exports: [LedgerParties],
})
export class MovementsModule {}
