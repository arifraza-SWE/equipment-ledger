import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import type { Reservation, ReservationStanding, ReservationStatus } from '@equipment-ledger/shared';
import { type ClientSession, type FilterQuery, Model, Types } from 'mongoose';
import { StateConflictError } from '../../../common/errors/domain-error';
import { minutes } from '../../../common/time/instant';
import { ReservationRecord } from './reservation.schema';

export interface NewReservation {
  assetId: string;
  workerId: string;
  keeperId: string;
  startsAt: Date;
  endsAt: Date;
  note: string | null;
  createdAt: Date;
}

export interface ReservationListFilter {
  assetId?: string;
  workerId?: string;
  status?: ReservationStatus;
  from?: Date;
  to?: Date;
}

const WINDOW_CLAIMING_STATUSES: ReservationStatus[] = ['active', 'fulfilled'];

@Injectable()
export class ReservationsRepository {
  constructor(
    @InjectModel(ReservationRecord.name) private readonly reservations: Model<ReservationRecord>,
  ) {}

  async insert(newReservation: NewReservation, session: ClientSession): Promise<ReservationRecord> {
    const [created] = await this.reservations.create(
      [
        {
          ...newReservation,
          status: 'active',
          fulfilledByMovementId: null,
          closedAt: null,
          closedReason: null,
        },
      ],
      { session },
    );
    if (!created) {
      throw new Error('Reservation insert returned no document');
    }
    return created.toObject();
  }

  async findById(
    reservationId: string,
    session?: ClientSession,
  ): Promise<ReservationRecord | null> {
    return this.reservations
      .findById(reservationId)
      .session(session ?? null)
      .lean();
  }

  async findOverlapping(
    assetId: string,
    window: { startsAt: Date; endsAt: Date },
    session: ClientSession,
  ): Promise<ReservationRecord[]> {
    return this.reservations
      .find({
        assetId,
        status: { $in: WINDOW_CLAIMING_STATUSES },
        startsAt: { $lt: window.endsAt },
        endsAt: { $gt: window.startsAt },
      })
      .sort({ startsAt: 1 })
      .session(session)
      .lean();
  }

  async findActiveCovering(
    assetId: string,
    instant: Date,
    earlyCollectionGraceMinutes: number,
    session: ClientSession,
  ): Promise<ReservationRecord[]> {
    return this.reservations
      .find({
        assetId,
        status: 'active',
        startsAt: { $lte: new Date(instant.getTime() + minutes(earlyCollectionGraceMinutes)) },
        endsAt: { $gt: instant },
      })
      .sort({ startsAt: 1 })
      .session(session)
      .lean();
  }

  async findActiveEndingAfter(
    assetId: string,
    instant: Date,
    session: ClientSession,
  ): Promise<ReservationRecord[]> {
    return this.reservations
      .find({ assetId, status: 'active', endsAt: { $gt: instant } })
      .sort({ startsAt: 1 })
      .session(session)
      .lean();
  }

  /** Reservations that stood, unclosed, at the given instant and had not yet ended. */
  async findStandingAt(instant: Date): Promise<ReservationRecord[]> {
    return this.reservations
      .find({
        createdAt: { $lte: instant },
        endsAt: { $gt: instant },
        $or: [{ closedAt: null }, { closedAt: { $gt: instant } }],
      })
      .sort({ startsAt: 1 })
      .lean();
  }

  async findForAsset(assetId: string): Promise<ReservationRecord[]> {
    return this.reservations.find({ assetId }).sort({ startsAt: -1 }).lean();
  }

  async list(filter: ReservationListFilter): Promise<ReservationRecord[]> {
    const query: FilterQuery<ReservationRecord> = {};
    if (filter.assetId) {
      query.assetId = filter.assetId;
    }
    if (filter.workerId) {
      query.workerId = filter.workerId;
    }
    if (filter.status) {
      query.status = filter.status;
    }
    if (filter.from) {
      query.endsAt = { $gt: filter.from };
    }
    if (filter.to) {
      query.startsAt = { $lt: filter.to };
    }
    return this.reservations.find(query).sort({ startsAt: -1 }).lean();
  }

  async markFulfilled(
    reservationId: Types.ObjectId,
    movementId: Types.ObjectId,
    closedAt: Date,
    session: ClientSession,
  ): Promise<void> {
    const outcome = await this.reservations.updateOne(
      { _id: reservationId, status: 'active' },
      {
        $set: {
          status: 'fulfilled',
          fulfilledByMovementId: movementId,
          closedAt,
          closedReason: 'collected',
        },
      },
      { session },
    );
    if (outcome.matchedCount === 0) {
      throw new StateConflictError(
        'reservation_not_active',
        'This reservation is no longer active; it was collected, cancelled or voided by another request.',
        { reservationId: reservationId.toHexString() },
      );
    }
  }

  /** A correction replaces the movement that collected a reservation, so the link has to follow. */
  async relinkFulfilment(
    reservationId: Types.ObjectId,
    movementId: Types.ObjectId,
    session: ClientSession,
  ): Promise<void> {
    await this.reservations.updateOne(
      { _id: reservationId, status: 'fulfilled' },
      { $set: { fulfilledByMovementId: movementId } },
      { session },
    );
  }

  /** Undoes a void when the withdrawal that caused it is itself voided. */
  async reinstate(reservationId: Types.ObjectId, session: ClientSession): Promise<void> {
    await this.reservations.updateOne(
      { _id: reservationId, status: 'voided' },
      { $set: { status: 'active', closedAt: null, closedReason: null } },
      { session },
    );
  }

  async reopen(reservationId: Types.ObjectId, session: ClientSession): Promise<void> {
    await this.reservations.updateOne(
      { _id: reservationId, status: 'fulfilled' },
      {
        $set: { status: 'active', fulfilledByMovementId: null, closedAt: null, closedReason: null },
      },
      { session },
    );
  }

  async close(
    reservationId: Types.ObjectId,
    status: 'cancelled' | 'voided',
    closedAt: Date,
    closedReason: string,
    session: ClientSession,
  ): Promise<boolean> {
    const outcome = await this.reservations.updateOne(
      { _id: reservationId, status: 'active' },
      { $set: { status, closedAt, closedReason } },
      { session },
    );
    return outcome.matchedCount === 1;
  }

  async insertMany(
    records: Array<
      NewReservation & {
        _id: Types.ObjectId;
        status: ReservationStatus;
        fulfilledByMovementId: Types.ObjectId | null;
        closedAt: Date | null;
        closedReason: string | null;
      }
    >,
  ): Promise<void> {
    if (records.length > 0) {
      await this.reservations.insertMany(records);
    }
  }

  async deleteAll(): Promise<void> {
    await this.reservations.deleteMany({});
  }
}

export function toReservation(record: ReservationRecord, now: Date): Reservation {
  return {
    reservationId: record._id.toHexString(),
    assetId: record.assetId,
    workerId: record.workerId,
    keeperId: record.keeperId,
    startsAt: record.startsAt.toISOString(),
    endsAt: record.endsAt.toISOString(),
    status: record.status,
    standing: standingAt(record, now),
    note: record.note,
    createdAt: record.createdAt.toISOString(),
    fulfilledByMovementId: record.fulfilledByMovementId
      ? record.fulfilledByMovementId.toHexString()
      : null,
    closedAt: record.closedAt ? record.closedAt.toISOString() : null,
    closedReason: record.closedReason,
  };
}

export function standingAt(record: ReservationRecord, instant: Date): ReservationStanding | null {
  const openAtInstant =
    record.createdAt <= instant && (record.closedAt === null || record.closedAt > instant);
  if (!openAtInstant) {
    return null;
  }
  if (instant < record.startsAt) {
    return 'upcoming';
  }
  if (instant < record.endsAt) {
    return 'current';
  }
  return 'uncollected';
}
