import { Injectable } from '@nestjs/common';
import type { ClientSession } from 'mongoose';
import { NotFoundError } from '../../common/errors/domain-error';
import { type AssetRecord } from '../assets/asset.schema';
import { AssetsRepository } from '../assets/assets.repository';
import { type KeeperRecord } from '../keepers/keeper.schema';
import { KeepersRepository } from '../keepers/keepers.repository';
import { type WorkerRecord } from '../workers/worker.schema';
import { WorkersRepository } from '../workers/workers.repository';

@Injectable()
export class LedgerParties {
  constructor(
    private readonly assets: AssetsRepository,
    private readonly workers: WorkersRepository,
    private readonly keepers: KeepersRepository,
  ) {}

  async requireAsset(assetId: string, session: ClientSession): Promise<AssetRecord> {
    const asset = await this.assets.findById(assetId, session);
    if (!asset) {
      throw new NotFoundError(`There is no asset ${assetId} in the store.`, { assetId });
    }
    return asset;
  }

  async requireWorker(workerId: string, session: ClientSession): Promise<WorkerRecord> {
    const worker = await this.workers.findById(workerId, session);
    if (!worker) {
      throw new NotFoundError(`There is no worker ${workerId}.`, { workerId });
    }
    return worker;
  }

  async requireKeeper(keeperId: string, session: ClientSession): Promise<KeeperRecord> {
    const keeper = await this.keepers.findById(keeperId, session);
    if (!keeper) {
      throw new NotFoundError(`There is no store keeper ${keeperId}.`, { keeperId });
    }
    return keeper;
  }

  async workerNameLookup(
    workerIds: ReadonlyArray<string | null>,
  ): Promise<(workerId: string | null) => string> {
    const presentIds = workerIds.filter((workerId): workerId is string => workerId !== null);
    const records = await this.workers.findByIds(presentIds);
    return (workerId) => {
      if (!workerId) {
        return 'nobody';
      }
      const record = records.get(workerId);
      return record ? `${record.fullName} (${workerId})` : workerId;
    };
  }
}
