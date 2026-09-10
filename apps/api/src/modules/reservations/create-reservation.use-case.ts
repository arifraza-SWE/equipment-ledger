import { Inject, Injectable } from '@nestjs/common';
import type { CreateReservationRequest, Reservation } from '@equipment-ledger/shared';
import { RuleViolationError, StateConflictError } from '../../common/errors/domain-error';
import { CLOCK, type Clock } from '../../common/time/clock';

import { requireInstant } from '../../common/time/require-instant';
import { TransactionRunner } from '../../database/transaction-runner';
import { AssetsRepository } from '../assets/assets.repository';
import { replayTimeline } from '../ledger/domain/asset-timeline';
import { MovementsRepository, toTimelineEntry } from '../ledger/persistence/movements.repository';
import {
  ReservationsRepository,
  toReservation,
} from '../ledger/persistence/reservations.repository';
import { LedgerParties } from '../movements/ledger-parties';
import { checkCertification } from '../workers/domain/certification-check';
import { certificationRefusal } from '../workers/domain/certification-refusal';
import { describeWindowProblem, findReservationWindowProblem } from './domain/reservation-window';
import { describeInstant } from '../../config/site-time';

@Injectable()
export class CreateReservationUseCase {
  constructor(
    private readonly parties: LedgerParties,
    private readonly assets: AssetsRepository,
    private readonly movements: MovementsRepository,
    private readonly reservations: ReservationsRepository,
    private readonly transactions: TransactionRunner,
    @Inject(CLOCK) private readonly clock: Clock,
  ) {}

  async execute(request: CreateReservationRequest): Promise<Reservation> {
    const window = {
      startsAt: requireInstant(request.startsAt, 'startsAt'),
      endsAt: requireInstant(request.endsAt, 'endsAt'),
    };
    const windowProblem = findReservationWindowProblem(window, this.clock.now());
    if (windowProblem) {
      throw new RuleViolationError(
        'reservation_window_invalid',
        describeWindowProblem(windowProblem),
        {
          problem: windowProblem.kind,
        },
      );
    }

    const created = await this.transactions.run(async (session) => {
      const now = this.clock.now();
      const asset = await this.parties.requireAsset(request.assetId, session);
      const worker = await this.parties.requireWorker(request.workerId, session);
      const keeper = await this.parties.requireKeeper(request.keeperId, session);

      const timeline = (await this.movements.findEffectiveTimeline(asset._id, session)).map(
        toTimelineEntry,
      );
      const state = replayTimeline(timeline);
      if (state.serviceStatus === 'out_of_service') {
        throw new RuleViolationError(
          'asset_out_of_service',
          `${asset._id} is out of service${state.serviceChangedBy ? ` (since ${describeInstant(state.serviceChangedBy.effectiveAt)})` : ''} and cannot be reserved until it is back in service.`,
          { assetId: asset._id },
        );
      }

      if (asset.requiredCertification) {
        const certification = checkCertification(
          worker.certifications,
          asset.requiredCertification,
          window.startsAt,
        );
        if (!certification.qualified) {
          throw certificationRefusal(certification, {
            workerId: worker._id,
            workerName: worker.fullName,
            assetId: asset._id,
            requiredCertification: asset.requiredCertification,
            purpose: 'reserve',
          });
        }
      }

      const [conflicting] = await this.reservations.findOverlapping(asset._id, window, session);
      if (conflicting) {
        const workerName = await this.parties.workerNameLookup([conflicting.workerId]);
        throw new StateConflictError(
          'reservation_overlap',
          `${asset._id} is already reserved by ${workerName(conflicting.workerId)} from ${describeInstant(conflicting.startsAt)} to ${describeInstant(conflicting.endsAt)}. Reservations on one asset cannot overlap; they may start exactly when another ends.`,
          {
            assetId: asset._id,
            conflictingReservationId: conflicting._id.toHexString(),
            conflictingStartsAt: conflicting.startsAt.toISOString(),
            conflictingEndsAt: conflicting.endsAt.toISOString(),
          },
        );
      }

      await this.assets.claimLedgerWrite(asset._id, asset.version, session);
      const record = await this.reservations.insert(
        {
          assetId: asset._id,
          workerId: worker._id,
          keeperId: keeper._id,
          startsAt: window.startsAt,
          endsAt: window.endsAt,
          note: request.note ?? null,
          createdAt: now,
        },
        session,
      );
      return { record, now };
    });

    return toReservation(created.record, created.now);
  }
}
