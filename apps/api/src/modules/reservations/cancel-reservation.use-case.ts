import { Inject, Injectable } from '@nestjs/common';
import type { Reservation } from '@equipment-ledger/shared';
import { NotFoundError, StateConflictError } from '../../common/errors/domain-error';
import { CLOCK, type Clock } from '../../common/time/clock';
import { TransactionRunner } from '../../database/transaction-runner';
import {
  ReservationsRepository,
  toReservation,
} from '../ledger/persistence/reservations.repository';

const CANCELLED_BY_KEEPER = 'Cancelled at the hatch';

@Injectable()
export class CancelReservationUseCase {
  constructor(
    private readonly reservations: ReservationsRepository,
    private readonly transactions: TransactionRunner,
    @Inject(CLOCK) private readonly clock: Clock,
  ) {}

  async execute(reservationId: string): Promise<Reservation> {
    return this.transactions.run(async (session) => {
      const now = this.clock.now();
      const reservation = await this.reservations.findById(reservationId, session);
      if (!reservation) {
        throw new NotFoundError(`There is no reservation ${reservationId}.`, { reservationId });
      }
      const closed = await this.reservations.close(
        reservation._id,
        'cancelled',
        now,
        CANCELLED_BY_KEEPER,
        session,
      );
      if (!closed) {
        throw new StateConflictError(
          'reservation_not_active',
          `Reservation ${reservationId} is already ${reservation.status}${reservation.closedReason ? ` (${reservation.closedReason})` : ''}.`,
          { reservationId, status: reservation.status },
        );
      }
      return toReservation(
        { ...reservation, status: 'cancelled', closedAt: now, closedReason: CANCELLED_BY_KEEPER },
        now,
      );
    });
  }
}
