import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import type { Asset } from '@equipment-ledger/shared';
import { type ClientSession, Model } from 'mongoose';
import { ConcurrentModificationError } from '../../common/errors/domain-error';
import { AssetRecord } from './asset.schema';

export interface NewAsset {
  assetId: string;
  kind: Asset['kind'];
  description: string;
  requiredCertification: Asset['requiredCertification'];
  registeredAt: Date;
  version: number;
}

@Injectable()
export class AssetsRepository {
  constructor(@InjectModel(AssetRecord.name) private readonly assets: Model<AssetRecord>) {}

  async findAll(): Promise<AssetRecord[]> {
    return this.assets.find().sort({ _id: 1 }).lean();
  }

  async findRegisteredBy(instant: Date): Promise<AssetRecord[]> {
    return this.assets.find({ registeredAt: { $lte: instant } }).sort({ _id: 1 }).lean();
  }

  async findById(assetId: string, session?: ClientSession): Promise<AssetRecord | null> {
    return this.assets.findById(assetId).session(session ?? null).lean();
  }

  async findEarliestRegistration(): Promise<Date | null> {
    const earliest = await this.assets.findOne().sort({ registeredAt: 1 }).select({ registeredAt: 1 }).lean();
    return earliest?.registeredAt ?? null;
  }

  /**
   * Every write to an asset's ledger goes through here, inside the same transaction as the
   * ledger entry it produces. Two transactions that both try to move `version` past the same
   * number cannot both succeed: one is rejected here (or by MongoDB's write-conflict detection
   * on the document) and is retried against the state the other one left behind.
   */
  async claimLedgerWrite(assetId: string, expectedVersion: number, session: ClientSession): Promise<number> {
    const updated = await this.assets
      .findOneAndUpdate(
        { _id: assetId, version: expectedVersion },
        { $inc: { version: 1 } },
        { new: true, session },
      )
      .lean();
    if (!updated) {
      throw new ConcurrentModificationError(assetId);
    }
    return updated.version;
  }

  async insertMany(newAssets: NewAsset[]): Promise<void> {
    await this.assets.insertMany(
      newAssets.map((newAsset) => ({
        _id: newAsset.assetId,
        kind: newAsset.kind,
        description: newAsset.description,
        requiredCertification: newAsset.requiredCertification,
        registeredAt: newAsset.registeredAt,
        version: newAsset.version,
      })),
    );
  }

  async deleteAll(): Promise<void> {
    await this.assets.deleteMany({});
  }
}

export function toAsset(record: AssetRecord): Asset {
  return {
    assetId: record._id,
    kind: record.kind,
    description: record.description,
    requiredCertification: record.requiredCertification,
    registeredAt: record.registeredAt.toISOString(),
  };
}
