import type { INestApplicationContext } from '@nestjs/common';
import { getConnectionToken } from '@nestjs/mongoose';
import type { Connection, Types } from 'mongoose';
import { addMinutes } from '../common/time/instant';
import { AssetsRepository } from '../modules/assets/assets.repository';
import { KeepersRepository } from '../modules/keepers/keepers.repository';
import { findTimelineViolation, sortTimeline } from '../modules/ledger/domain/asset-timeline';
import { CorrectionsRepository } from '../modules/ledger/persistence/corrections.repository';
import { type MovementRecord } from '../modules/ledger/persistence/movement.schema';
import {
  MovementsRepository,
  toTimelineEntry,
} from '../modules/ledger/persistence/movements.repository';
import { type ReservationRecord } from '../modules/ledger/persistence/reservation.schema';
import { ReservationsRepository } from '../modules/ledger/persistence/reservations.repository';
import { WorkersRepository } from '../modules/workers/workers.repository';
import { seedClock, type SeedClock } from './anchor';
import { buildAssetCatalogue, KEEPERS, WORKERS, workerCertificationDates } from './catalogue';
import { deterministicObjectId } from './deterministic-id';
import { buildRoutineLoans } from './routine-loans';
import { buildScenarios, type SeedLoan, type SeedScenarios } from './scenarios';

export interface SeedSummary {
  anchor: string;
  assets: number;
  workers: number;
  keepers: number;
  movements: number;
  corrections: number;
  reservations: number;
}

const RECORDED_LAG_MINUTES = 3;
const REGISTRATION_DAY_OFFSET = -45;

type SeedMovement = Omit<MovementRecord, 'sequence'> & { sequence: number };
type SeedReservationRecord = ReservationRecord;

/**
 * Replaces the whole store with the fixed dataset. Every document id is derived from a label,
 * so running this twice yields the same collections, byte for byte, apart from timestamps that
 * are themselves derived from the anchor date.
 */
export async function seedStore(
  context: INestApplicationContext,
  anchor: Date,
): Promise<SeedSummary> {
  const clock = seedClock(anchor);
  const connection = context.get<Connection>(getConnectionToken());
  const assets = context.get(AssetsRepository);
  const workers = context.get(WorkersRepository);
  const keepers = context.get(KeepersRepository);
  const movements = context.get(MovementsRepository);
  const corrections = context.get(CorrectionsRepository);
  const reservations = context.get(ReservationsRepository);

  const catalogue = buildAssetCatalogue();
  const scenarios = buildScenarios(clock);
  const loans = [...scenarios.loans, ...buildRoutineLoans(clock)];
  const reservationRecords = compileReservations(scenarios, clock);
  const { movementRecords, correctionRecords } = compileLedger(loans, scenarios);
  const registeredAt = clock.at(REGISTRATION_DAY_OFFSET, '08:00');

  assertConsistent(
    movementRecords,
    catalogue.map((asset) => asset.assetId),
  );
  await syncIndexes(connection);

  await Promise.all([
    assets.deleteAll(),
    workers.deleteAll(),
    keepers.deleteAll(),
    movements.deleteAll(),
    corrections.deleteAll(),
    reservations.deleteAll(),
    connection.collection('idempotency_records').deleteMany({}),
  ]);

  const writesPerAsset = countWritesPerAsset(movementRecords, reservationRecords);
  await assets.insertMany(
    catalogue.map((asset) => ({
      ...asset,
      registeredAt,
      version: writesPerAsset.get(asset.assetId) ?? 0,
    })),
  );
  await workers.insertMany(
    WORKERS.map((worker) => ({
      workerId: worker.workerId,
      fullName: worker.fullName,
      trade: worker.trade,
      certifications: workerCertificationDates(worker, clock),
      registeredAt,
    })),
  );
  await keepers.insertMany(KEEPERS);
  await movements.insertMany(movementRecords);
  await corrections.insertMany(correctionRecords);
  await reservations.insertMany(reservationRecords);

  return {
    anchor: anchor.toISOString(),
    assets: catalogue.length,
    workers: WORKERS.length,
    keepers: KEEPERS.length,
    movements: movementRecords.length,
    corrections: correctionRecords.length,
    reservations: reservationRecords.length,
  };
}

function compileReservations(scenarios: SeedScenarios, clock: SeedClock): SeedReservationRecord[] {
  return scenarios.reservations.map((reservation) => {
    const base = {
      _id: deterministicObjectId(`reservation:${reservation.label}`),
      assetId: reservation.assetId,
      workerId: reservation.workerId,
      keeperId: reservation.keeperId,
      startsAt: reservation.startsAt,
      endsAt: reservation.endsAt,
      note: reservation.note ?? null,
      createdAt: reservation.createdAt,
    };
    switch (reservation.outcome.kind) {
      case 'standing':
        return {
          ...base,
          status: 'active' as const,
          fulfilledByMovementId: null,
          closedAt: null,
          closedReason: null,
        };
      case 'fulfilled': {
        const loanLabel = scenarios.loans.find(
          (loan) => loan.reservationLabel === reservation.label,
        )?.label;
        if (!loanLabel) {
          throw new Error(
            `Seed reservation "${reservation.label}" is fulfilled but no loan references it`,
          );
        }
        const fulfillingLoan = scenarios.loans.find((loan) => loan.label === loanLabel);
        return {
          ...base,
          status: 'fulfilled' as const,
          fulfilledByMovementId: movementId(loanLabel, 'issue'),
          closedAt: fulfillingLoan ? recordedAfter(fulfillingLoan.issuedAt) : clock.anchor,
          closedReason: 'collected',
        };
      }
      case 'cancelled':
        return {
          ...base,
          status: 'cancelled' as const,
          fulfilledByMovementId: null,
          closedAt: reservation.outcome.closedAt,
          closedReason: 'Cancelled at the hatch',
        };
      case 'voided':
        return {
          ...base,
          status: 'voided' as const,
          fulfilledByMovementId: null,
          closedAt: reservation.outcome.closedAt,
          closedReason: reservation.outcome.reason,
        };
    }
  });
}

function compileLedger(loans: SeedLoan[], scenarios: SeedScenarios) {
  const reservationIds = new Map(
    scenarios.reservations.map((reservation) => [
      reservation.label,
      deterministicObjectId(`reservation:${reservation.label}`),
    ]),
  );
  const movementRecords: SeedMovement[] = [];

  for (const loan of loans) {
    movementRecords.push({
      _id: movementId(loan.label, 'issue'),
      assetId: loan.assetId,
      type: 'issue',
      workerId: loan.workerId,
      returnedByWorkerId: null,
      keeperId: loan.keeperId,
      effectiveAt: loan.issuedAt,
      recordedAt: loan.issueRecordedAt ?? recordedAfter(loan.issuedAt),
      dueAt: loan.dueAt,
      reservationId: loan.reservationLabel
        ? (reservationIds.get(loan.reservationLabel) ?? null)
        : null,
      note: loan.issueNote ?? null,
      sequence: 0,
      supersededByCorrectionId: null,
      createdByCorrectionId: null,
    });
    if (loan.returnedAt) {
      movementRecords.push({
        _id: movementId(loan.label, 'return'),
        assetId: loan.assetId,
        type: 'return',
        workerId: loan.workerId,
        returnedByWorkerId: loan.returnedByWorkerId ?? loan.workerId,
        keeperId: loan.keeperId,
        effectiveAt: loan.returnedAt,
        recordedAt: loan.returnRecordedAt ?? recordedAfter(loan.returnedAt),
        dueAt: null,
        reservationId: null,
        note: loan.returnNote ?? null,
        sequence: 0,
        supersededByCorrectionId: null,
        createdByCorrectionId: null,
      });
      if (loan.withdrawnOnReturn) {
        movementRecords.push({
          _id: deterministicObjectId(`movement:${loan.label}:withdrawal`),
          assetId: loan.assetId,
          type: 'out_of_service',
          workerId: null,
          returnedByWorkerId: null,
          keeperId: loan.keeperId,
          effectiveAt: loan.returnedAt,
          recordedAt: loan.returnRecordedAt ?? recordedAfter(loan.returnedAt),
          dueAt: null,
          reservationId: null,
          note: loan.withdrawnOnReturn,
          sequence: 0,
          supersededByCorrectionId: null,
          createdByCorrectionId: null,
        });
      }
    }
  }

  for (const serviceEvent of scenarios.serviceEvents) {
    movementRecords.push({
      _id: deterministicObjectId(`movement:${serviceEvent.label}`),
      assetId: serviceEvent.assetId,
      type: serviceEvent.type,
      workerId: null,
      returnedByWorkerId: null,
      keeperId: serviceEvent.keeperId,
      effectiveAt: serviceEvent.effectiveAt,
      recordedAt: serviceEvent.recordedAt ?? recordedAfter(serviceEvent.effectiveAt),
      dueAt: null,
      reservationId: null,
      note: serviceEvent.note,
      sequence: 0,
      supersededByCorrectionId: null,
      createdByCorrectionId: null,
    });
  }

  assignSequences(movementRecords);

  const correctionRecords = scenarios.corrections.map((correction) => {
    const originalId = movementId(correction.targetLoanLabel, correction.targetMovement);
    const original = movementRecords.find((record) => record._id.equals(originalId));
    if (!original) {
      throw new Error(
        `Seed correction "${correction.label}" targets a movement that does not exist`,
      );
    }
    const correctionId = deterministicObjectId(`correction:${correction.label}`);
    const replacement: SeedMovement = {
      ...original,
      _id: deterministicObjectId(`movement:${correction.label}:replacement`),
      effectiveAt: correction.newEffectiveAt,
      recordedAt: correction.recordedAt,
      supersededByCorrectionId: null,
      createdByCorrectionId: correctionId,
    };
    original.supersededByCorrectionId = correctionId;
    movementRecords.push(replacement);
    return {
      _id: correctionId,
      assetId: original.assetId,
      originalMovementId: original._id,
      replacementMovementId: replacement._id,
      kind: 'amend' as const,
      reason: correction.reason,
      keeperId: correction.keeperId,
      recordedAt: correction.recordedAt,
      changes: [
        {
          field: 'effectiveAt' as const,
          from: original.effectiveAt.toISOString(),
          to: correction.newEffectiveAt.toISOString(),
        },
      ],
    };
  });

  return { movementRecords, correctionRecords };
}

function assignSequences(movementRecords: SeedMovement[]): void {
  const byAsset = new Map<string, SeedMovement[]>();
  for (const record of movementRecords) {
    const forAsset = byAsset.get(record.assetId) ?? [];
    forAsset.push(record);
    byAsset.set(record.assetId, forAsset);
  }
  for (const records of byAsset.values()) {
    records
      .sort(
        (left, right) =>
          left.effectiveAt.getTime() - right.effectiveAt.getTime() ||
          typeOrder(left) - typeOrder(right),
      )
      .forEach((record, index) => {
        record.sequence = index + 1;
      });
  }
}

function typeOrder(record: SeedMovement): number {
  return record.type === 'return' ? 0 : record.type === 'out_of_service' ? 1 : 2;
}

function countWritesPerAsset(
  movementRecords: SeedMovement[],
  reservationRecords: SeedReservationRecord[],
): Map<string, number> {
  const counts = new Map<string, number>();
  for (const record of [...movementRecords, ...reservationRecords]) {
    counts.set(record.assetId, (counts.get(record.assetId) ?? 0) + 1);
  }
  return counts;
}

function assertConsistent(movementRecords: SeedMovement[], assetIds: string[]): void {
  const known = new Set(assetIds);
  const byAsset = new Map<string, SeedMovement[]>();
  for (const record of movementRecords) {
    if (!known.has(record.assetId)) {
      throw new Error(`Seed movement references unknown asset ${record.assetId}`);
    }
    if (record.supersededByCorrectionId) {
      continue;
    }
    const forAsset = byAsset.get(record.assetId) ?? [];
    forAsset.push(record);
    byAsset.set(record.assetId, forAsset);
  }
  for (const [assetId, records] of byAsset) {
    const violation = findTimelineViolation(
      sortTimeline(records.map((record) => toTimelineEntry(record))),
    );
    if (violation) {
      throw new Error(
        `Seed data would give ${assetId} an impossible history: ${violation.kind} at ${violation.entry.effectiveAt.toISOString()}`,
      );
    }
  }
}

async function syncIndexes(connection: Connection): Promise<void> {
  await Promise.all(Object.values(connection.models).map((model) => model.syncIndexes()));
}

function movementId(loanLabel: string, kind: 'issue' | 'return'): Types.ObjectId {
  return deterministicObjectId(`movement:${loanLabel}:${kind}`);
}

function recordedAfter(effectiveAt: Date): Date {
  return addMinutes(effectiveAt, RECORDED_LAG_MINUTES);
}
