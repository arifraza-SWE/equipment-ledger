import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import type { Keeper } from '@equipment-ledger/shared';
import { type ClientSession, Model } from 'mongoose';
import { KeeperRecord } from './keeper.schema';

@Injectable()
export class KeepersRepository {
  constructor(@InjectModel(KeeperRecord.name) private readonly keepers: Model<KeeperRecord>) {}

  async findAll(): Promise<KeeperRecord[]> {
    return this.keepers.find().sort({ _id: 1 }).lean();
  }

  async findById(keeperId: string, session?: ClientSession): Promise<KeeperRecord | null> {
    return this.keepers
      .findById(keeperId)
      .session(session ?? null)
      .lean();
  }

  async findByIds(keeperIds: readonly string[]): Promise<Map<string, KeeperRecord>> {
    const uniqueIds = [...new Set(keeperIds)];
    if (uniqueIds.length === 0) {
      return new Map();
    }
    const records = await this.keepers.find({ _id: { $in: uniqueIds } }).lean();
    return new Map(records.map((record) => [record._id, record]));
  }

  async insertMany(newKeepers: Keeper[]): Promise<void> {
    await this.keepers.insertMany(
      newKeepers.map((newKeeper) => ({ _id: newKeeper.keeperId, fullName: newKeeper.fullName })),
    );
  }

  async deleteAll(): Promise<void> {
    await this.keepers.deleteMany({});
  }
}

export function toKeeper(record: KeeperRecord): Keeper {
  return { keeperId: record._id, fullName: record.fullName };
}
