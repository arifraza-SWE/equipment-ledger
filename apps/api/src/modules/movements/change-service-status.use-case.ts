import { Inject, Injectable } from '@nestjs/common';
import type {
  ChangeServiceStatusRequest,
  ServiceStatusChangeResult,
} from '@equipment-ledger/shared';
import { CLOCK, type Clock } from '../../common/time/clock';
import { requireInstant } from '../../common/time/require-instant';
import { TransactionRunner } from '../../database/transaction-runner';
import { AssetsRepository } from '../assets/assets.repository';
import {
  findTimelineViolation,
  sortTimeline,
  type TimelineEntry,
} from '../ledger/domain/asset-timeline';
import {
  MovementsRepository,
  toMovement,
  toTimelineEntry,
} from '../ledger/persistence/movements.repository';
import { StoreSnapshotService } from '../ledger/store-snapshot.service';
import { LedgerParties } from './ledger-parties';
import { ServiceWithdrawalRecorder } from './service-withdrawal.recorder';
import {
  assertEntryCanBeAppended,
  PENDING_ENTRY_ID,
  PENDING_ENTRY_SEQUENCE,
  timelineViolationToError,
} from './timeline-conflicts';

@Injectable()
export class ChangeServiceStatusUseCase {
  constructor(
    private readonly parties: LedgerParties,
    private readonly assets: AssetsRepository,
    private readonly movements: MovementsRepository,
    private readonly withdrawals: ServiceWithdrawalRecorder,
    private readonly transactions: TransactionRunner,
    private readonly snapshots: StoreSnapshotService,
    @Inject(CLOCK) private readonly clock: Clock,
  ) {}

  async execute(
    assetId: string,
    request: ChangeServiceStatusRequest,
  ): Promise<ServiceStatusChangeResult> {
    const outcome = await this.transactions.run(async (session) => {
      const now = this.clock.now();
      const effectiveAt = requireInstant(request.effectiveAt, 'effectiveAt');
      const asset = await this.parties.requireAsset(assetId, session);
      const keeper = await this.parties.requireKeeper(request.keeperId, session);

      const timeline = (await this.movements.findEffectiveTimeline(asset._id, session)).map(
        toTimelineEntry,
      );
      const movementType =
        request.status === 'out_of_service' ? 'out_of_service' : 'back_in_service';
      assertEntryCanBeAppended({
        timeline,
        type: movementType,
        effectiveAt,
        assetId: asset._id,
        registeredAt: asset.registeredAt,
        now,
      });

      const candidate: TimelineEntry = {
        movementId: PENDING_ENTRY_ID,
        type: movementType,
        effectiveAt,
        sequence: PENDING_ENTRY_SEQUENCE,
        workerId: null,
        dueAt: null,
        reservationId: null,
      };
      const violation = findTimelineViolation(sortTimeline([...timeline, candidate]));
      if (violation) {
        const workerName = await this.parties.workerNameLookup([]);
        throw timelineViolationToError(violation, { assetId: asset._id, workerName });
      }

      if (movementType === 'out_of_service') {
        return this.withdrawals.record(
          {
            assetId: asset._id,
            keeperId: keeper._id,
            effectiveAt,
            reason: request.reason,
            now,
            expectedVersion: asset.version,
          },
          session,
        );
      }

      const sequence = await this.assets.claimLedgerWrite(asset._id, asset.version, session);
      const movement = await this.movements.insert(
        {
          assetId: asset._id,
          type: 'back_in_service',
          workerId: null,
          returnedByWorkerId: null,
          keeperId: keeper._id,
          effectiveAt,
          recordedAt: now,
          dueAt: null,
          reservationId: null,
          note: request.reason,
          sequence,
          createdByCorrectionId: null,
        },
        session,
      );
      return { movement, voidedReservations: [] };
    });

    return {
      movement: toMovement(outcome.movement),
      asset: await this.snapshots.assetAt(assetId, this.clock.now()),
      voidedReservations: outcome.voidedReservations,
    };
  }
}
