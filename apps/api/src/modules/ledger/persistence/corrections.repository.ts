import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import type { Correction, CorrectionChange, CorrectionKind } from '@equipment-ledger/shared';
import { type ClientSession, Model, Types } from 'mongoose';
import { CorrectionRecord } from './correction.schema';

export interface NewCorrection {
  assetId: string;
  originalMovementId: Types.ObjectId;
  kind: CorrectionKind;
  reason: string;
  keeperId: string;
  recordedAt: Date;
  changes: CorrectionChange[];
}

@Injectable()
export class CorrectionsRepository {
  constructor(
    @InjectModel(CorrectionRecord.name) private readonly corrections: Model<CorrectionRecord>,
  ) {}

  async insert(newCorrection: NewCorrection, session: ClientSession): Promise<CorrectionRecord> {
    const [created] = await this.corrections.create(
      [{ ...newCorrection, replacementMovementId: null }],
      {
        session,
      },
    );
    if (!created) {
      throw new Error('Correction insert returned no document');
    }
    return created.toObject();
  }

  async attachReplacement(
    correctionId: Types.ObjectId,
    replacementMovementId: Types.ObjectId,
    session: ClientSession,
  ): Promise<void> {
    await this.corrections.updateOne(
      { _id: correctionId },
      { $set: { replacementMovementId } },
      { session },
    );
  }

  async findForAsset(assetId: string): Promise<CorrectionRecord[]> {
    return this.corrections.find({ assetId }).sort({ recordedAt: 1 }).lean();
  }

  async insertMany(
    records: Array<
      NewCorrection & { _id: Types.ObjectId; replacementMovementId: Types.ObjectId | null }
    >,
  ): Promise<void> {
    if (records.length > 0) {
      await this.corrections.insertMany(records);
    }
  }

  async deleteAll(): Promise<void> {
    await this.corrections.deleteMany({});
  }
}

export function toCorrection(record: CorrectionRecord): Correction {
  return {
    correctionId: record._id.toHexString(),
    assetId: record.assetId,
    originalMovementId: record.originalMovementId.toHexString(),
    replacementMovementId: record.replacementMovementId
      ? record.replacementMovementId.toHexString()
      : null,
    kind: record.kind,
    reason: record.reason,
    keeperId: record.keeperId,
    recordedAt: record.recordedAt.toISOString(),
    changes: record.changes.map((change) => ({
      field: change.field,
      from: change.from,
      to: change.to,
    })),
  };
}
