import { ISSUE_RULES, MOVEMENT_TYPE_LABELS } from '@equipment-ledger/shared';
import {
  type DomainError,
  RuleViolationError,
  StateConflictError,
} from '../../common/errors/domain-error';
import { describeInstant, minutes } from '../../common/time/instant';
import type { TimelineEntry, TimelineViolation } from '../ledger/domain/asset-timeline';

export interface TimelineNames {
  assetId: string;
  workerName: (workerId: string | null) => string;
}

export function assertEntryCanBeAppended(input: {
  timeline: readonly TimelineEntry[];
  effectiveAt: Date;
  assetId: string;
  registeredAt: Date;
  now: Date;
}): void {
  const { timeline, effectiveAt, assetId, registeredAt, now } = input;
  assertNotInFuture(effectiveAt, now);
  if (effectiveAt < registeredAt) {
    throw new RuleViolationError(
      'timeline_conflict',
      `${assetId} was not registered in the store until ${describeInstant(registeredAt)}, so nothing can have happened to it at ${describeInstant(effectiveAt)}.`,
      { assetId, registeredAt: registeredAt.toISOString() },
    );
  }
  const latest = timeline[timeline.length - 1];
  if (latest && latest.effectiveAt > effectiveAt) {
    throw new RuleViolationError(
      'timeline_conflict',
      `${assetId} already has a later entry on its ledger (${MOVEMENT_TYPE_LABELS[latest.type].toLowerCase()} at ${describeInstant(latest.effectiveAt)}). A new entry cannot be slotted in before it. If that later entry is wrong, correct it instead.`,
      {
        assetId,
        laterMovementId: latest.movementId,
        laterEffectiveAt: latest.effectiveAt.toISOString(),
      },
    );
  }
}

export function assertNotInFuture(effectiveAt: Date, now: Date): void {
  if (effectiveAt.getTime() > now.getTime() + minutes(ISSUE_RULES.futureToleranceMinutes)) {
    throw new RuleViolationError(
      'timeline_conflict',
      `${describeInstant(effectiveAt)} is in the future. The ledger records things after they happen; to claim an asset for later, make a reservation.`,
      { effectiveAt: effectiveAt.toISOString(), now: now.toISOString() },
    );
  }
}

export function timelineViolationToError(
  violation: TimelineViolation,
  names: TimelineNames,
): DomainError {
  const { assetId } = names;
  const at = describeInstant(violation.entry.effectiveAt);

  switch (violation.kind) {
    case 'issue_while_held': {
      const holder = names.workerName(violation.holdingEntry.workerId);
      return new StateConflictError(
        'asset_already_issued',
        `${assetId} is already issued to ${holder}; it went out at ${describeInstant(violation.holdingEntry.effectiveAt)} and had not been returned at ${at}.`,
        {
          assetId,
          holderWorkerId: violation.holdingEntry.workerId,
          issuedAt: violation.holdingEntry.effectiveAt.toISOString(),
        },
      );
    }
    case 'issue_while_out_of_service':
      return new RuleViolationError(
        'asset_out_of_service',
        `${assetId} was out of service at ${at} (withdrawn at ${describeInstant(violation.withdrawalEntry.effectiveAt)}). It cannot be issued until it is brought back into service.`,
        { assetId, withdrawnAt: violation.withdrawalEntry.effectiveAt.toISOString() },
      );
    case 'return_without_issue':
      return new StateConflictError(
        'asset_not_issued',
        violation.previousReturn
          ? `${assetId} was already in store at ${at}: it came back at ${describeInstant(violation.previousReturn.effectiveAt)} and was not issued again before then.`
          : `${assetId} had not been issued to anyone at ${at}, so it cannot be returned then.`,
        { assetId },
      );
    case 'return_not_after_issue':
      return new RuleViolationError(
        'timeline_conflict',
        `A return at ${at} cannot be at or before the issue it closes; ${assetId} went out at ${describeInstant(violation.issueEntry.effectiveAt)}.`,
        { assetId, issuedAt: violation.issueEntry.effectiveAt.toISOString() },
      );
    case 'already_out_of_service':
      return new StateConflictError(
        'asset_already_out_of_service',
        `${assetId} was already out of service at ${at} (withdrawn at ${describeInstant(violation.withdrawalEntry.effectiveAt)}).`,
        { assetId },
      );
    case 'already_in_service':
      return new StateConflictError(
        'asset_already_in_service',
        `${assetId} was already in service at ${at}.`,
        { assetId },
      );
  }
}

export const PENDING_ENTRY_ID = 'pending';
export const PENDING_ENTRY_SEQUENCE = Number.MAX_SAFE_INTEGER;
