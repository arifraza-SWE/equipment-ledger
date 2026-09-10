import { Injectable } from '@nestjs/common';
import type { Reservation } from '@equipment-ledger/shared';
import { type ClientSession, Types } from 'mongoose';
import { AssetsRepository } from '../assets/assets.repository';
import { type MovementRecord } from '../ledger/persistence/movement.schema';
import { MovementsRepository } from '../ledger/persistence/movements.repository';
import {
  ReservationsRepository,
  toReservation,
} from '../ledger/persistence/reservations.repository';

export interface ServiceWithdrawal {
  assetId: string;
  keeperId: string;
  effectiveAt: Date;
  reason: string;
  now: Date;
  expectedVersion: number;
  pairedWithMovementId?: Types.ObjectId | null;
}

export interface ServiceWithdrawalOutcome {
  movement: MovementRecord;
  voidedReservations: Reservation[];
}

export const OUT_OF_SERVICE_VOID_REASON = 'Asset taken out of service';

/**
 * Taking an asset out of service is a ledger fact like any other, so it goes on the movements
 * collection with an effective and a recorded time. Reservations that were still standing are
 * voided rather than deleted: the worker can see what happened and why, and re-reserve once the
 * asset is back.
 */
@Injectable()
export class ServiceWithdrawalRecorder {
  constructor(
    private readonly assets: AssetsRepository,
    private readonly movements: MovementsRepository,
    private readonly reservations: ReservationsRepository,
  ) {}

  async record(
    withdrawal: ServiceWithdrawal,
    session: ClientSession,
  ): Promise<ServiceWithdrawalOutcome> {
    const sequence = await this.assets.claimLedgerWrite(
      withdrawal.assetId,
      withdrawal.expectedVersion,
      session,
    );
    const standing = await this.reservations.findActiveEndingAfter(
      withdrawal.assetId,
      withdrawal.now,
      session,
    );
    const voided: Reservation[] = [];
    const voidedReservationIds: Types.ObjectId[] = [];
    for (const reservation of standing) {
      const closed = await this.reservations.close(
        reservation._id,
        'voided',
        withdrawal.now,
        OUT_OF_SERVICE_VOID_REASON,
        session,
      );
      if (closed) {
        voidedReservationIds.push(reservation._id);
        voided.push(
          toReservation(
            {
              ...reservation,
              status: 'voided',
              closedAt: withdrawal.now,
              closedReason: OUT_OF_SERVICE_VOID_REASON,
            },
            withdrawal.now,
          ),
        );
      }
    }

    const movement = await this.movements.insert(
      {
        assetId: withdrawal.assetId,
        type: 'out_of_service',
        workerId: null,
        returnedByWorkerId: null,
        keeperId: withdrawal.keeperId,
        effectiveAt: withdrawal.effectiveAt,
        recordedAt: withdrawal.now,
        dueAt: null,
        reservationId: null,
        note: withdrawal.reason,
        sequence,
        createdByCorrectionId: null,
        pairedWithMovementId: withdrawal.pairedWithMovementId ?? null,
        voidedReservationIds,
      },
      session,
    );

    return { movement, voidedReservations: voided };
  }
}
