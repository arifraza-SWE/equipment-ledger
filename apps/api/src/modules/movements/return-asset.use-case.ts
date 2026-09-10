import { Inject, Injectable } from '@nestjs/common';
import type { MovementResult, ReturnAssetRequest } from '@equipment-ledger/shared';
import { RuleViolationError } from '../../common/errors/domain-error';
import { CLOCK, type Clock } from '../../common/time/clock';
import { requireInstant } from '../../common/time/require-instant';
import { TransactionRunner } from '../../database/transaction-runner';
import { AssetsRepository } from '../assets/assets.repository';
import {
  findTimelineViolation,
  replayTimeline,
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

const RETURNED_DAMAGED_REASON = 'Returned damaged';

@Injectable()
export class ReturnAssetUseCase {
  constructor(
    private readonly parties: LedgerParties,
    private readonly assets: AssetsRepository,
    private readonly movements: MovementsRepository,
    private readonly withdrawals: ServiceWithdrawalRecorder,
    private readonly transactions: TransactionRunner,
    private readonly snapshots: StoreSnapshotService,
    @Inject(CLOCK) private readonly clock: Clock,
  ) {}

  async execute(request: ReturnAssetRequest): Promise<MovementResult> {
    const effectiveAt = requireInstant(request.effectiveAt, 'effectiveAt');

    const outcome = await this.transactions.run(async (session) => {
      const now = this.clock.now();
      const asset = await this.parties.requireAsset(request.assetId, session);
      const returner = await this.parties.requireWorker(request.returnedByWorkerId, session);
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

      const holding = replayTimeline(timeline).holding;
      const workerName = await this.parties.workerNameLookup([
        holding?.workerId ?? null,
        returner._id,
      ]);

      const candidate: TimelineEntry = {
        movementId: PENDING_ENTRY_ID,
        type: 'return',
        effectiveAt,
        sequence: PENDING_ENTRY_SEQUENCE,
        workerId: holding?.workerId ?? null,
        dueAt: null,
        reservationId: null,
      };
      const violation = findTimelineViolation(sortTimeline([...timeline, candidate]));
      if (violation || !holding) {
        throw timelineViolationToError(
          violation ?? { kind: 'return_without_issue', entry: candidate, previousReturn: null },
          { assetId: asset._id, workerName },
        );
      }

      if (holding.workerId !== returner._id && !request.acknowledgeDifferentReturner) {
        throw new RuleViolationError(
          'returner_mismatch',
          `${asset._id} is held by ${workerName(holding.workerId)}, not ${workerName(returner._id)}. If ${returner.fullName} is handing it back on their behalf, confirm the return from a different worker.`,
          {
            assetId: asset._id,
            holderWorkerId: holding.workerId,
            returnedByWorkerId: returner._id,
          },
        );
      }

      const sequence = await this.assets.claimLedgerWrite(asset._id, asset.version, session);
      const returnMovement = await this.movements.insert(
        {
          assetId: asset._id,
          type: 'return',
          workerId: holding.workerId,
          returnedByWorkerId: returner._id,
          keeperId: keeper._id,
          effectiveAt,
          recordedAt: now,
          dueAt: null,
          reservationId: null,
          note: request.note ?? null,
          sequence,
          createdByCorrectionId: null,
        },
        session,
      );

      if (!request.takeOutOfService) {
        return { returnMovement, withdrawal: null };
      }
      const withdrawal = await this.withdrawals.record(
        {
          assetId: asset._id,
          keeperId: keeper._id,
          effectiveAt,
          reason: request.note ?? RETURNED_DAMAGED_REASON,
          now,
          expectedVersion: sequence,
        },
        session,
      );
      return { returnMovement, withdrawal };
    });

    return {
      movement: toMovement(outcome.returnMovement),
      asset: await this.snapshots.assetAt(outcome.returnMovement.assetId, this.clock.now()),
      serviceStatusChange: outcome.withdrawal ? toMovement(outcome.withdrawal.movement) : null,
      voidedReservations: outcome.withdrawal ? outcome.withdrawal.voidedReservations : [],
    };
  }
}
