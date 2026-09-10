import { Inject, Injectable } from '@nestjs/common';
import {
  type CorrectionChange,
  type CorrectionResult,
  type CorrectMovementRequest,
} from '@equipment-ledger/shared';
import type { ClientSession } from 'mongoose';
import {
  NotFoundError,
  RuleViolationError,
  StateConflictError,
} from '../../common/errors/domain-error';
import { CLOCK, type Clock } from '../../common/time/clock';
import { describeInstant } from '../../common/time/instant';
import { requireInstant } from '../../common/time/require-instant';
import { TransactionRunner } from '../../database/transaction-runner';
import { type AssetRecord } from '../assets/asset.schema';
import { AssetsRepository } from '../assets/assets.repository';
import {
  findTimelineViolation,
  type TimelineEntry,
  withEntryReplaced,
} from '../ledger/domain/asset-timeline';
import { CorrectionsRepository, toCorrection } from '../ledger/persistence/corrections.repository';
import { type MovementRecord } from '../ledger/persistence/movement.schema';
import {
  MovementsRepository,
  type NewMovement,
  toMovement,
  toTimelineEntry,
} from '../ledger/persistence/movements.repository';
import { ReservationsRepository } from '../ledger/persistence/reservations.repository';
import { StoreSnapshotService } from '../ledger/store-snapshot.service';
import { checkCertification } from '../workers/domain/certification-check';
import { certificationRefusal } from '../workers/domain/certification-refusal';
import { LedgerParties } from './ledger-parties';
import { assertNotInFuture, timelineViolationToError } from './timeline-conflicts';

interface ReplacementDraft {
  fields: Omit<NewMovement, 'recordedAt' | 'sequence' | 'createdByCorrectionId'>;
  changes: CorrectionChange[];
}

@Injectable()
export class CorrectMovementUseCase {
  constructor(
    private readonly parties: LedgerParties,
    private readonly assets: AssetsRepository,
    private readonly movements: MovementsRepository,
    private readonly corrections: CorrectionsRepository,
    private readonly reservations: ReservationsRepository,
    private readonly transactions: TransactionRunner,
    private readonly snapshots: StoreSnapshotService,
    @Inject(CLOCK) private readonly clock: Clock,
  ) {}

  async execute(movementId: string, request: CorrectMovementRequest): Promise<CorrectionResult> {
    const outcome = await this.transactions.run(async (session) => {
      const now = this.clock.now();
      const original = await this.movements.findById(movementId, session);
      if (!original) {
        throw new NotFoundError(`There is no movement ${movementId}.`, { movementId });
      }
      if (original.supersededByCorrectionId) {
        throw new StateConflictError(
          'movement_already_corrected',
          `This movement was already corrected (correction ${original.supersededByCorrectionId.toHexString()}). Correct its replacement instead; the ledger keeps one line of corrections per fact.`,
          { movementId, correctionId: original.supersededByCorrectionId.toHexString() },
        );
      }
      const asset = await this.parties.requireAsset(original.assetId, session);
      const keeper = await this.parties.requireKeeper(request.keeperId, session);

      const draft =
        request.kind === 'amend'
          ? await this.draftReplacement(original, request, asset, now, session)
          : null;
      const timeline = (await this.movements.findEffectiveTimeline(asset._id, session)).map(
        toTimelineEntry,
      );
      const candidateEntry: TimelineEntry | null = draft
        ? {
            movementId: original._id.toHexString(),
            type: draft.fields.type,
            effectiveAt: draft.fields.effectiveAt,
            sequence: original.sequence,
            workerId: draft.fields.workerId,
            dueAt: draft.fields.dueAt,
            reservationId: draft.fields.reservationId
              ? draft.fields.reservationId.toHexString()
              : null,
          }
        : null;
      const violation = findTimelineViolation(
        withEntryReplaced(timeline, original._id.toHexString(), candidateEntry),
      );
      if (violation) {
        const workerName = await this.parties.workerNameLookup(
          timeline.map((entry) => entry.workerId),
        );
        const underlying = timelineViolationToError(violation, { assetId: asset._id, workerName });
        throw new RuleViolationError(
          'correction_invalid',
          `That correction would make the history of ${asset._id} impossible: ${underlying.message}`,
          { movementId, ...underlying.details },
        );
      }

      await this.assets.claimLedgerWrite(asset._id, asset.version, session);
      const correction = await this.corrections.insert(
        {
          assetId: asset._id,
          originalMovementId: original._id,
          kind: request.kind,
          reason: request.reason,
          keeperId: keeper._id,
          recordedAt: now,
          changes: draft ? draft.changes : [],
        },
        session,
      );

      let replacement: MovementRecord | null = null;
      if (draft) {
        replacement = await this.movements.insert(
          {
            ...draft.fields,
            recordedAt: now,
            sequence: original.sequence,
            createdByCorrectionId: correction._id,
          },
          session,
        );
        await this.corrections.attachReplacement(correction._id, replacement._id, session);
      }
      await this.movements.markSuperseded(original._id, correction._id, session);

      if (!draft && original.type === 'issue' && original.reservationId) {
        await this.reservations.reopen(original.reservationId, session);
      }

      return {
        correction: { ...correction, replacementMovementId: replacement ? replacement._id : null },
        original: { ...original, supersededByCorrectionId: correction._id },
        replacement,
      };
    });

    return {
      correction: toCorrection(outcome.correction),
      original: toMovement(outcome.original),
      replacement: outcome.replacement ? toMovement(outcome.replacement) : null,
      asset: await this.snapshots.assetAt(outcome.original.assetId, this.clock.now()),
    };
  }

  private async draftReplacement(
    original: MovementRecord,
    request: CorrectMovementRequest,
    asset: AssetRecord,
    now: Date,
    session: ClientSession,
  ): Promise<ReplacementDraft> {
    const changes: CorrectionChange[] = [];
    const fields: ReplacementDraft['fields'] = {
      assetId: original.assetId,
      type: original.type,
      workerId: original.workerId,
      returnedByWorkerId: original.returnedByWorkerId,
      keeperId: original.keeperId,
      effectiveAt: original.effectiveAt,
      dueAt: original.dueAt,
      reservationId: original.reservationId,
      note: original.note,
    };

    if (request.effectiveAt !== undefined) {
      const effectiveAt = requireInstant(request.effectiveAt, 'effectiveAt');
      assertNotInFuture(effectiveAt, now);
      if (effectiveAt < asset.registeredAt) {
        throw new RuleViolationError(
          'correction_invalid',
          `${asset._id} was not registered until ${describeInstant(asset.registeredAt)}; a movement cannot be moved before that.`,
        );
      }
      if (effectiveAt.getTime() !== original.effectiveAt.getTime()) {
        changes.push({
          field: 'effectiveAt',
          from: original.effectiveAt.toISOString(),
          to: effectiveAt.toISOString(),
        });
        fields.effectiveAt = effectiveAt;
      }
    }

    if (request.workerId !== undefined) {
      if (original.type !== 'issue') {
        throw new RuleViolationError(
          'correction_invalid',
          'Only an issue names the worker who received the asset; on a return, correct returnedByWorkerId instead.',
        );
      }
      if (request.workerId !== original.workerId) {
        await this.parties.requireWorker(request.workerId, session);
        changes.push({ field: 'workerId', from: original.workerId, to: request.workerId });
        fields.workerId = request.workerId;
      }
    }

    if (request.returnedByWorkerId !== undefined) {
      if (original.type !== 'return') {
        throw new RuleViolationError(
          'correction_invalid',
          'Only a return records who handed the asset back.',
        );
      }
      if (request.returnedByWorkerId !== original.returnedByWorkerId) {
        await this.parties.requireWorker(request.returnedByWorkerId, session);
        changes.push({
          field: 'returnedByWorkerId',
          from: original.returnedByWorkerId,
          to: request.returnedByWorkerId,
        });
        fields.returnedByWorkerId = request.returnedByWorkerId;
      }
    }

    if (request.dueAt !== undefined) {
      if (original.type !== 'issue') {
        throw new RuleViolationError('correction_invalid', 'Only an issue has a due time.');
      }
      const dueAt = request.dueAt === null ? null : requireInstant(request.dueAt, 'dueAt');
      if (dueAt?.getTime() !== original.dueAt?.getTime()) {
        changes.push({
          field: 'dueAt',
          from: original.dueAt?.toISOString() ?? null,
          to: dueAt?.toISOString() ?? null,
        });
        fields.dueAt = dueAt;
      }
    }

    if (request.note !== undefined && (request.note ?? null) !== original.note) {
      changes.push({ field: 'note', from: original.note, to: request.note ?? null });
      fields.note = request.note ?? null;
    }

    if (changes.length === 0) {
      throw new RuleViolationError(
        'correction_invalid',
        'Nothing would change. A correction has to alter at least one field, or void the movement.',
      );
    }
    if (fields.type === 'issue' && fields.dueAt && fields.dueAt <= fields.effectiveAt) {
      throw new RuleViolationError(
        'correction_invalid',
        'The due time must be after the issue time.',
      );
    }
    if (fields.type === 'issue' && fields.workerId && asset.requiredCertification) {
      const worker = await this.parties.requireWorker(fields.workerId, session);
      const certification = checkCertification(
        worker.certifications,
        asset.requiredCertification,
        fields.effectiveAt,
      );
      if (!certification.qualified) {
        throw certificationRefusal(certification, {
          workerId: worker._id,
          workerName: worker.fullName,
          assetId: asset._id,
          requiredCertification: asset.requiredCertification,
          purpose: 'receive',
        });
      }
    }

    return { fields, changes };
  }
}
