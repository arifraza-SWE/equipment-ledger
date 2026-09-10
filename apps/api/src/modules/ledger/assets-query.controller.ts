import { Controller, Get, Inject, Param } from '@nestjs/common';
import type { AssetHistory, AssetSnapshot } from '@equipment-ledger/shared';
import { CLOCK, type Clock } from '../../common/time/clock';
import { AssetHistoryService } from './asset-history.service';
import { StoreSnapshotService } from './store-snapshot.service';

@Controller('assets')
export class AssetsQueryController {
  constructor(
    private readonly snapshots: StoreSnapshotService,
    private readonly history: AssetHistoryService,
    @Inject(CLOCK) private readonly clock: Clock,
  ) {}

  @Get()
  async list(): Promise<AssetSnapshot[]> {
    const store = await this.snapshots.storeAt(this.clock.now());
    return store.assets;
  }

  @Get(':assetId')
  async detail(@Param('assetId') assetId: string): Promise<AssetSnapshot> {
    return this.snapshots.assetNow(assetId);
  }

  @Get(':assetId/history')
  async assetHistory(@Param('assetId') assetId: string): Promise<AssetHistory> {
    return this.history.historyOf(assetId);
  }
}
