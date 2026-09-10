import type { MovementType, ServiceStatus } from '@equipment-ledger/shared';

export interface TimelineEntry {
  movementId: string;
  type: MovementType;
  effectiveAt: Date;
  sequence: number;
  workerId: string | null;
  dueAt: Date | null;
  reservationId: string | null;
}

export interface AssetLedgerState {
  holding: TimelineEntry | null;
  serviceStatus: ServiceStatus;
  serviceChangedBy: TimelineEntry | null;
  lastEntry: TimelineEntry | null;
}

export type TimelineViolation =
  | { kind: 'issue_while_held'; entry: TimelineEntry; holdingEntry: TimelineEntry }
  | { kind: 'issue_while_out_of_service'; entry: TimelineEntry; withdrawalEntry: TimelineEntry }
  | { kind: 'return_without_issue'; entry: TimelineEntry; previousReturn: TimelineEntry | null }
  | { kind: 'return_not_after_issue'; entry: TimelineEntry; issueEntry: TimelineEntry }
  | { kind: 'already_out_of_service'; entry: TimelineEntry; withdrawalEntry: TimelineEntry }
  | { kind: 'already_in_service'; entry: TimelineEntry };

export const HOLDING_MOVEMENT_TYPES: readonly MovementType[] = ['issue', 'return'];
export const SERVICE_MOVEMENT_TYPES: readonly MovementType[] = [
  'out_of_service',
  'back_in_service',
];

export function compareTimelineOrder(
  left: { effectiveAt: Date; sequence: number },
  right: { effectiveAt: Date; sequence: number },
): number {
  const byInstant = left.effectiveAt.getTime() - right.effectiveAt.getTime();
  return byInstant !== 0 ? byInstant : left.sequence - right.sequence;
}

export function sortTimeline<T extends { effectiveAt: Date; sequence: number }>(
  entries: readonly T[],
): T[] {
  return [...entries].sort(compareTimelineOrder);
}

export function replayTimeline(sortedEntries: readonly TimelineEntry[]): AssetLedgerState {
  let holding: TimelineEntry | null = null;
  let serviceStatus: ServiceStatus = 'in_service';
  let serviceChangedBy: TimelineEntry | null = null;
  let lastEntry: TimelineEntry | null = null;

  for (const entry of sortedEntries) {
    switch (entry.type) {
      case 'issue':
        holding = entry;
        break;
      case 'return':
        holding = null;
        break;
      case 'out_of_service':
        serviceStatus = 'out_of_service';
        serviceChangedBy = entry;
        break;
      case 'back_in_service':
        serviceStatus = 'in_service';
        serviceChangedBy = entry;
        break;
    }
    lastEntry = entry;
  }

  return { holding, serviceStatus, serviceChangedBy, lastEntry };
}

/**
 * A movement takes effect at its own instant, inclusive: at exactly the issue time the asset is
 * out, at exactly the return time it is back.
 */
export function stateAt(sortedEntries: readonly TimelineEntry[], instant: Date): AssetLedgerState {
  return replayTimeline(sortedEntries.filter((entry) => entry.effectiveAt <= instant));
}

export function findTimelineViolation(
  sortedEntries: readonly TimelineEntry[],
): TimelineViolation | null {
  let holding: TimelineEntry | null = null;
  let withdrawal: TimelineEntry | null = null;
  let previousReturn: TimelineEntry | null = null;

  for (const entry of sortedEntries) {
    switch (entry.type) {
      case 'issue':
        if (holding) {
          return { kind: 'issue_while_held', entry, holdingEntry: holding };
        }
        if (withdrawal) {
          return { kind: 'issue_while_out_of_service', entry, withdrawalEntry: withdrawal };
        }
        holding = entry;
        break;
      case 'return':
        if (!holding) {
          return { kind: 'return_without_issue', entry, previousReturn };
        }
        if (entry.effectiveAt <= holding.effectiveAt) {
          return { kind: 'return_not_after_issue', entry, issueEntry: holding };
        }
        previousReturn = entry;
        holding = null;
        break;
      case 'out_of_service':
        if (withdrawal) {
          return { kind: 'already_out_of_service', entry, withdrawalEntry: withdrawal };
        }
        withdrawal = entry;
        break;
      case 'back_in_service':
        if (!withdrawal) {
          return { kind: 'already_in_service', entry };
        }
        withdrawal = null;
        break;
    }
  }

  return null;
}

export function withEntryReplaced(
  sortedEntries: readonly TimelineEntry[],
  originalMovementId: string,
  replacement: TimelineEntry | null,
): TimelineEntry[] {
  const remaining = sortedEntries.filter((entry) => entry.movementId !== originalMovementId);
  return sortTimeline(replacement ? [...remaining, replacement] : remaining);
}
