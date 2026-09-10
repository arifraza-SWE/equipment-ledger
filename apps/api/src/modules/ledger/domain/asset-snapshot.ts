import type {
  Asset,
  AssetHolding,
  AssetSnapshot,
  AssetStatus,
  Reservation,
  ServiceStatus,
  StoreSnapshotTotals,
} from '@equipment-ledger/shared';
import type { TimelineEntry } from './asset-timeline';

export interface AssetSnapshotInput {
  asset: Asset;
  holding: TimelineEntry | null;
  serviceStatus: ServiceStatus;
  standingReservations: readonly Reservation[];
  workerNames: ReadonlyMap<string, string>;
  instant: Date;
}

export function assembleAssetSnapshot(input: AssetSnapshotInput): AssetSnapshot {
  const holding = input.holding ? describeHolding(input.holding, input.workerNames) : null;
  const overdue = Boolean(input.holding?.dueAt && input.holding.dueAt < input.instant);
  const currentReservation = input.standingReservations.find((reservation) => reservation.standing === 'current') ?? null;
  const nextReservation =
    input.standingReservations
      .filter((reservation) => reservation.standing === 'upcoming')
      .sort((left, right) => left.startsAt.localeCompare(right.startsAt))[0] ?? null;

  return {
    asset: input.asset,
    status: deriveAssetStatus({ holding, overdue, serviceStatus: input.serviceStatus, currentReservation }),
    serviceStatus: input.serviceStatus,
    holding,
    overdue,
    currentReservation,
    nextReservation,
  };
}

export function deriveAssetStatus(state: {
  holding: AssetHolding | null;
  overdue: boolean;
  serviceStatus: ServiceStatus;
  currentReservation: Reservation | null;
}): AssetStatus {
  if (state.holding) {
    return state.overdue ? 'overdue' : 'issued';
  }
  if (state.serviceStatus === 'out_of_service') {
    return 'out_of_service';
  }
  if (state.currentReservation) {
    return 'reserved';
  }
  return 'in_store';
}

export function countTotals(snapshots: readonly AssetSnapshot[]): StoreSnapshotTotals {
  return snapshots.reduce<StoreSnapshotTotals>(
    (totals, snapshot) => ({
      assets: totals.assets + 1,
      inStore: totals.inStore + (snapshot.status === 'in_store' ? 1 : 0),
      issued: totals.issued + (snapshot.holding ? 1 : 0),
      overdue: totals.overdue + (snapshot.overdue ? 1 : 0),
      reserved: totals.reserved + (snapshot.status === 'reserved' ? 1 : 0),
      outOfService: totals.outOfService + (snapshot.serviceStatus === 'out_of_service' ? 1 : 0),
    }),
    { assets: 0, inStore: 0, issued: 0, overdue: 0, reserved: 0, outOfService: 0 },
  );
}

function describeHolding(holding: TimelineEntry, workerNames: ReadonlyMap<string, string>): AssetHolding {
  const workerId = holding.workerId ?? '';
  return {
    movementId: holding.movementId,
    worker: { workerId, fullName: workerNames.get(workerId) ?? workerId },
    effectiveAt: holding.effectiveAt.toISOString(),
    dueAt: holding.dueAt ? holding.dueAt.toISOString() : null,
    reservationId: holding.reservationId,
  };
}
