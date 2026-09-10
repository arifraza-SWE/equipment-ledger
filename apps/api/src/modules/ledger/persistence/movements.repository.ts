import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import type { Movement, MovementType } from '@equipment-ledger/shared';
import { type ClientSession, type FilterQuery, Model, Types } from 'mongoose';
import { InvalidRequestError, StateConflictError } from '../../../common/errors/domain-error';
import { HOLDING_MOVEMENT_TYPES, type TimelineEntry } from '../domain/asset-timeline';
import { MovementRecord } from './movement.schema';

export interface NewMovement {
  assetId: string;
  type: MovementType;
  workerId: string | null;
  returnedByWorkerId: string | null;
  keeperId: string;
  effectiveAt: Date;
  recordedAt: Date;
  dueAt: Date | null;
  reservationId: Types.ObjectId | null;
  note: string | null;
  sequence: number;
  createdByCorrectionId: Types.ObjectId | null;
  pairedWithMovementId?: Types.ObjectId | null;
  voidedReservationIds?: Types.ObjectId[];
}

export interface LatestEntriesForAsset {
  holding: MovementRecord | null;
  service: MovementRecord | null;
}

export interface MovementListFilter {
  assetId?: string;
  workerId?: string;
  from?: Date;
  to?: Date;
}

export interface MovementPage {
  records: MovementRecord[];
  nextCursor: string | null;
}

type LedgerTrack = 'holding' | 'service';

interface LatestEntryRow {
  _id: { assetId: string; track: LedgerTrack };
  latest: MovementRecord;
}

@Injectable()
export class MovementsRepository {
  constructor(
    @InjectModel(MovementRecord.name) private readonly movements: Model<MovementRecord>,
  ) {}

  async insert(newMovement: NewMovement, session: ClientSession): Promise<MovementRecord> {
    const [created] = await this.movements.create(
      [
        {
          ...newMovement,
          pairedWithMovementId: newMovement.pairedWithMovementId ?? null,
          voidedReservationIds: newMovement.voidedReservationIds ?? [],
          supersededByCorrectionId: null,
        },
      ],
      { session },
    );
    if (!created) {
      throw new Error('Movement insert returned no document');
    }
    return created.toObject();
  }

  async findById(movementId: string, session?: ClientSession): Promise<MovementRecord | null> {
    return this.movements
      .findById(movementId)
      .session(session ?? null)
      .lean();
  }

  async findPairedWith(
    movementId: Types.ObjectId,
    session: ClientSession,
  ): Promise<MovementRecord | null> {
    return this.movements
      .findOne({ pairedWithMovementId: movementId, supersededByCorrectionId: null })
      .session(session)
      .lean();
  }

  async findEffectiveTimeline(assetId: string, session?: ClientSession): Promise<MovementRecord[]> {
    return this.movements
      .find({ assetId, supersededByCorrectionId: null })
      .sort({ effectiveAt: 1, sequence: 1 })
      .session(session ?? null)
      .lean();
  }

  async findAllForAsset(assetId: string): Promise<MovementRecord[]> {
    return this.movements
      .find({ assetId })
      .sort({ effectiveAt: 1, sequence: 1, recordedAt: 1 })
      .lean();
  }

  async findRecentForWorker(workerId: string, limit: number): Promise<MovementRecord[]> {
    return this.movements
      .find({ $or: [{ workerId }, { returnedByWorkerId: workerId }] })
      .sort({ effectiveAt: -1, sequence: -1 })
      .limit(limit)
      .lean();
  }

  /**
   * The only field on a movement that ever changes after it is written. It moves from null to a
   * correction id exactly once; the conditional filter is what makes two simultaneous corrections
   * of the same movement impossible.
   */
  async markSuperseded(
    movementId: Types.ObjectId,
    correctionId: Types.ObjectId,
    session: ClientSession,
  ): Promise<void> {
    const outcome = await this.movements.updateOne(
      { _id: movementId, supersededByCorrectionId: null },
      { $set: { supersededByCorrectionId: correctionId } },
      { session },
    );
    if (outcome.matchedCount === 0) {
      throw new StateConflictError(
        'movement_already_corrected',
        'This movement was corrected by another request a moment ago. Reload the history and correct the replacement instead.',
        { movementId: movementId.toHexString() },
      );
    }
  }

  /**
   * Latest effective entry per asset and per track (holding / service) as of an instant.
   * Superseded entries are excluded, so a corrected movement reads through to its replacement.
   */
  async findLatestEffectivePerAsset(instant: Date): Promise<Map<string, LatestEntriesForAsset>> {
    const rows = await this.movements.aggregate<LatestEntryRow>([
      { $match: { supersededByCorrectionId: null, effectiveAt: { $lte: instant } } },
      {
        $addFields: {
          track: { $cond: [{ $in: ['$type', HOLDING_MOVEMENT_TYPES] }, 'holding', 'service'] },
        },
      },
      {
        $group: {
          _id: { assetId: '$assetId', track: '$track' },
          latest: { $top: { sortBy: { effectiveAt: -1, sequence: -1 }, output: '$$ROOT' } },
        },
      },
    ]);

    const byAsset = new Map<string, LatestEntriesForAsset>();
    for (const row of rows) {
      const entries = byAsset.get(row._id.assetId) ?? { holding: null, service: null };
      entries[row._id.track] = row.latest;
      byAsset.set(row._id.assetId, entries);
    }
    return byAsset;
  }

  async list(
    filter: MovementListFilter,
    cursor: string | null,
    limit: number,
  ): Promise<MovementPage> {
    const query: FilterQuery<MovementRecord> = {};
    if (filter.assetId) {
      query.assetId = filter.assetId;
    }
    if (filter.workerId) {
      query.workerId = filter.workerId;
    }
    if (filter.from || filter.to) {
      query.effectiveAt = {
        ...(filter.from ? { $gte: filter.from } : {}),
        ...(filter.to ? { $lte: filter.to } : {}),
      };
    }
    const cursorPosition = decodeCursor(cursor);
    if (cursorPosition) {
      query.$or = [
        { recordedAt: { $lt: cursorPosition.recordedAt } },
        { recordedAt: cursorPosition.recordedAt, _id: { $lt: cursorPosition.movementId } },
      ];
    }
    const records = await this.movements
      .find(query)
      .sort({ recordedAt: -1, _id: -1 })
      .limit(limit + 1)
      .lean();
    const hasMore = records.length > limit;
    const page = hasMore ? records.slice(0, limit) : records;
    const last = page[page.length - 1];
    return { records: page, nextCursor: hasMore && last ? encodeCursor(last) : null };
  }

  async insertMany(
    records: Array<
      NewMovement & { _id: Types.ObjectId; supersededByCorrectionId: Types.ObjectId | null }
    >,
  ): Promise<void> {
    if (records.length > 0) {
      await this.movements.insertMany(records);
    }
  }

  async deleteAll(): Promise<void> {
    await this.movements.deleteMany({});
  }
}

export function toMovement(record: MovementRecord): Movement {
  return {
    movementId: record._id.toHexString(),
    assetId: record.assetId,
    type: record.type,
    workerId: record.workerId,
    returnedByWorkerId: record.returnedByWorkerId,
    keeperId: record.keeperId,
    effectiveAt: record.effectiveAt.toISOString(),
    recordedAt: record.recordedAt.toISOString(),
    dueAt: record.dueAt ? record.dueAt.toISOString() : null,
    reservationId: record.reservationId ? record.reservationId.toHexString() : null,
    note: record.note,
    supersededByCorrectionId: record.supersededByCorrectionId
      ? record.supersededByCorrectionId.toHexString()
      : null,
    createdByCorrectionId: record.createdByCorrectionId
      ? record.createdByCorrectionId.toHexString()
      : null,
  };
}

export function toTimelineEntry(record: MovementRecord): TimelineEntry {
  return {
    movementId: record._id.toHexString(),
    type: record.type,
    effectiveAt: record.effectiveAt,
    sequence: record.sequence,
    workerId: record.workerId,
    dueAt: record.dueAt,
    reservationId: record.reservationId ? record.reservationId.toHexString() : null,
  };
}

function encodeCursor(record: MovementRecord): string {
  return `${record.recordedAt.getTime()}_${record._id.toHexString()}`;
}

function decodeCursor(
  cursor: string | null,
): { recordedAt: Date; movementId: Types.ObjectId } | null {
  if (!cursor) {
    return null;
  }
  const [recordedAtPart, movementIdPart] = cursor.split('_');
  const recordedAtMillis = Number(recordedAtPart);
  const withinRange =
    Number.isSafeInteger(recordedAtMillis) && Math.abs(recordedAtMillis) <= 8.64e15;
  if (!withinRange || !movementIdPart || !Types.ObjectId.isValid(movementIdPart)) {
    throw new InvalidRequestError(
      'validation_failed',
      'That page cursor is not one this ledger issued. Ask for the first page again.',
    );
  }
  return { recordedAt: new Date(recordedAtMillis), movementId: new Types.ObjectId(movementIdPart) };
}
