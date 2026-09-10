import { Inject, Injectable } from '@nestjs/common';
import { ISSUE_RULES, type IssueAssetRequest, type MovementResult } from '@equipment-ledger/shared';
import { type ClientSession, Types } from 'mongoose';
import {
  NotFoundError,
  RuleViolationError,
  StateConflictError,
} from '../../common/errors/domain-error';
import { CLOCK, type Clock } from '../../common/time/clock';
import { addHours, describeInstant } from '../../common/time/instant';
import { requireInstant } from '../../common/time/require-instant';
import { TransactionRunner } from '../../database/transaction-runner';
import { type AssetRecord } from '../assets/asset.schema';
import { AssetsRepository } from '../assets/assets.repository';
import {
  findTimelineViolation,
  replayTimeline,
  sortTimeline,
  type TimelineEntry,
} from '../ledger/domain/asset-timeline';
import { type MovementRecord } from '../ledger/persistence/movement.schema';
import {
  MovementsRepository,
  toMovement,
  toTimelineEntry,
} from '../ledger/persistence/movements.repository';
import { type ReservationRecord } from '../ledger/persistence/reservation.schema';
import { ReservationsRepository } from '../ledger/persistence/reservations.repository';
import { StoreSnapshotService } from '../ledger/store-snapshot.service';
import { type WorkerRecord } from '../workers/worker.schema';
import { checkCertification } from '../workers/domain/certification-check';
import { certificationRefusal } from '../workers/domain/certification-refusal';
import { LedgerParties } from './ledger-parties';
import {
  assertEntryCanBeAppended,
  PENDING_ENTRY_ID,
  PENDING_ENTRY_SEQUENCE,
  timelineViolationToError,
} from './timeline-conflicts';

@Injectable()
export class IssueAssetUseCase {
  constructor(
    private readonly parties: LedgerParties,
    private readonly assets: AssetsRepository,
    private readonly movements: MovementsRepository,
    private readonly reservations: ReservationsRepository,
    private readonly transactions: TransactionRunner,
    private readonly snapshots: StoreSnapshotService,
    @Inject(CLOCK) private readonly clock: Clock,
  ) {}

  async execute(request: IssueAssetRequest): Promise<MovementResult> {
    const effectiveAt = requireInstant(request.effectiveAt, 'effectiveAt');
    const requestedDueAt = request.dueAt ? requireInstant(request.dueAt, 'dueAt') : null;

    const issue = await this.transactions.run(async (session) => {
      const now = this.clock.now();
      const asset = await this.parties.requireAsset(request.assetId, session);
      const worker = await this.parties.requireWorker(request.workerId, session);
      const keeper = await this.parties.requireKeeper(request.keeperId, session);

      const timeline = (await this.movements.findEffectiveTimeline(asset._id, session)).map(
        toTimelineEntry,
      );
      assertEntryCanBeAppended({
        timeline,
        effectiveAt,
        assetId: asset._id,
        registeredAt: asset.registeredAt,
        now,
      });

      const reservation = await this.resolveReservation(
        asset,
        worker,
        effectiveAt,
        request.reservationId ?? null,
        session,
      );
      const dueAt =
        requestedDueAt ??
        reservation?.endsAt ??
        addHours(effectiveAt, ISSUE_RULES.defaultLoanHours);
      if (dueAt <= effectiveAt) {
        throw new RuleViolationError(
          'validation_failed',
          'The due time must be after the issue time.',
        );
      }

      const candidate: TimelineEntry = {
        movementId: PENDING_ENTRY_ID,
        type: 'issue',
        effectiveAt,
        sequence: PENDING_ENTRY_SEQUENCE,
        workerId: worker._id,
        dueAt,
        reservationId: reservation ? reservation._id.toHexString() : null,
      };
      const violation = findTimelineViolation(sortTimeline([...timeline, candidate]));
      if (violation) {
        const holder = replayTimeline(timeline).holding?.workerId ?? null;
        const workerName = await this.parties.workerNameLookup([holder, worker._id]);
        throw timelineViolationToError(violation, { assetId: asset._id, workerName });
      }

      const certification = checkCertification(
        worker.certifications,
        asset.requiredCertification,
        effectiveAt,
      );
      if (!certification.qualified && asset.requiredCertification) {
        throw certificationRefusal(certification, {
          workerId: worker._id,
          workerName: worker.fullName,
          assetId: asset._id,
          requiredCertification: asset.requiredCertification,
          purpose: 'receive',
        });
      }

      const sequence = await this.assets.claimLedgerWrite(asset._id, asset.version, session);
      const movement = await this.movements.insert(
        {
          assetId: asset._id,
          type: 'issue',
          workerId: worker._id,
          returnedByWorkerId: null,
          keeperId: keeper._id,
          effectiveAt,
          recordedAt: now,
          dueAt,
          reservationId: reservation ? reservation._id : null,
          note: request.note ?? null,
          sequence,
          createdByCorrectionId: null,
        },
        session,
      );
      if (reservation) {
        await this.reservations.markFulfilled(reservation._id, movement._id, now, session);
      }
      return movement;
    });

    return this.describe(issue);
  }

  private async resolveReservation(
    asset: AssetRecord,
    worker: WorkerRecord,
    effectiveAt: Date,
    requestedReservationId: string | null,
    session: ClientSession,
  ): Promise<ReservationRecord | null> {
    if (requestedReservationId) {
      return this.requireMatchingReservation(
        asset,
        worker,
        effectiveAt,
        requestedReservationId,
        session,
      );
    }

    const covering = await this.reservations.findActiveCovering(
      asset._id,
      effectiveAt,
      ISSUE_RULES.earlyCollectionGraceMinutes,
      session,
    );
    const ownReservation = covering.find((reservation) => reservation.workerId === worker._id);
    if (ownReservation) {
      return ownReservation;
    }
    const someoneElses = covering[0];
    if (someoneElses) {
      const workerName = await this.parties.workerNameLookup([someoneElses.workerId]);
      throw new StateConflictError(
        'asset_reserved_by_other',
        `${asset._id} is reserved by ${workerName(someoneElses.workerId)} from ${describeInstant(someoneElses.startsAt)} to ${describeInstant(someoneElses.endsAt)}. It can only be issued to them during that window.`,
        {
          assetId: asset._id,
          reservationId: someoneElses._id.toHexString(),
          reservedForWorkerId: someoneElses.workerId,
        },
      );
    }
    return null;
  }

  private async requireMatchingReservation(
    asset: AssetRecord,
    worker: WorkerRecord,
    effectiveAt: Date,
    reservationId: string,
    session: ClientSession,
  ): Promise<ReservationRecord> {
    const reservation = Types.ObjectId.isValid(reservationId)
      ? await this.reservations.findById(reservationId, session)
      : null;
    if (!reservation) {
      throw new NotFoundError(`There is no reservation ${reservationId}.`, { reservationId });
    }
    if (reservation.assetId !== asset._id || reservation.workerId !== worker._id) {
      throw new RuleViolationError(
        'reservation_mismatch',
        `Reservation ${reservationId} is for ${reservation.assetId} and worker ${reservation.workerId}, not ${asset._id} and ${worker._id}.`,
        {
          reservationId,
          reservedAssetId: reservation.assetId,
          reservedWorkerId: reservation.workerId,
        },
      );
    }
    if (reservation.status !== 'active') {
      throw new StateConflictError(
        'reservation_not_active',
        `Reservation ${reservationId} is ${reservation.status}${reservation.closedReason ? ` (${reservation.closedReason})` : ''} and cannot be collected against.`,
        { reservationId, status: reservation.status },
      );
    }
    const earliestCollection = new Date(
      reservation.startsAt.getTime() - ISSUE_RULES.earlyCollectionGraceMinutes * 60_000,
    );
    if (effectiveAt < earliestCollection || effectiveAt >= reservation.endsAt) {
      throw new RuleViolationError(
        'reservation_mismatch',
        `Reservation ${reservationId} runs from ${describeInstant(reservation.startsAt)} to ${describeInstant(reservation.endsAt)}; an issue at ${describeInstant(effectiveAt)} falls outside it.`,
        {
          reservationId,
          startsAt: reservation.startsAt.toISOString(),
          endsAt: reservation.endsAt.toISOString(),
        },
      );
    }
    return reservation;
  }

  private async describe(movement: MovementRecord): Promise<MovementResult> {
    return {
      movement: toMovement(movement),
      asset: await this.snapshots.assetAt(movement.assetId, this.clock.now()),
      serviceStatusChange: null,
      voidedReservations: [],
    };
  }
}
