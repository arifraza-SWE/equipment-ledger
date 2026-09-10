import type { Asset, Reservation } from '@equipment-ledger/shared';
import { assembleAssetSnapshot, countTotals, deriveAssetStatus } from './asset-snapshot';
import type { TimelineEntry } from './asset-timeline';

const asset: Asset = {
  assetId: 'HARN-014',
  kind: 'harness',
  description: 'Petzl Avao Bod full-body harness',
  requiredCertification: 'working_at_height',
  registeredAt: '2026-07-27T08:00:00.000Z',
};

const instant = new Date('2026-09-10T12:00:00Z');

function holding(dueAt: string | null): TimelineEntry {
  return {
    movementId: 'm1',
    type: 'issue',
    effectiveAt: new Date('2026-09-10T07:30:00Z'),
    sequence: 1,
    workerId: 'WKR-003',
    dueAt: dueAt ? new Date(dueAt) : null,
    reservationId: null,
  };
}

function reservation(standing: Reservation['standing'], startsAt: string): Reservation {
  return {
    reservationId: `r-${startsAt}`,
    assetId: asset.assetId,
    workerId: 'WKR-001',
    keeperId: 'KPR-01',
    startsAt,
    endsAt: '2026-09-12T16:00:00.000Z',
    status: 'active',
    standing,
    note: null,
    createdAt: '2026-09-01T00:00:00.000Z',
    fulfilledByMovementId: null,
    closedAt: null,
    closedReason: null,
  };
}

describe('assembleAssetSnapshot', () => {
  const workerNames = new Map([['WKR-003', 'Priya Raman']]);

  it('names the holder and keeps the issue instant', () => {
    const snapshot = assembleAssetSnapshot({
      asset,
      holding: holding('2026-09-10T17:00:00Z'),
      serviceStatus: 'in_service',
      standingReservations: [],
      workerNames,
      instant,
    });
    expect(snapshot.status).toBe('issued');
    expect(snapshot.holding).toMatchObject({
      worker: { workerId: 'WKR-003', fullName: 'Priya Raman' },
    });
    expect(snapshot.overdue).toBe(false);
  });

  it('flags an overdue holding', () => {
    const snapshot = assembleAssetSnapshot({
      asset,
      holding: holding('2026-09-10T11:00:00Z'),
      serviceStatus: 'in_service',
      standingReservations: [],
      workerNames,
      instant,
    });
    expect(snapshot.status).toBe('overdue');
    expect(snapshot.overdue).toBe(true);
  });

  it('picks the current reservation and the soonest upcoming one', () => {
    const snapshot = assembleAssetSnapshot({
      asset,
      holding: null,
      serviceStatus: 'in_service',
      standingReservations: [
        reservation('upcoming', '2026-09-14T08:00:00.000Z'),
        reservation('current', '2026-09-10T08:00:00.000Z'),
        reservation('upcoming', '2026-09-12T08:00:00.000Z'),
      ],
      workerNames,
      instant,
    });
    expect(snapshot.status).toBe('reserved');
    expect(snapshot.currentReservation?.startsAt).toBe('2026-09-10T08:00:00.000Z');
    expect(snapshot.nextReservation?.startsAt).toBe('2026-09-12T08:00:00.000Z');
  });
});

describe('deriveAssetStatus', () => {
  const noReservation = { currentReservation: null };

  it('prefers the holding over the service status', () => {
    expect(
      deriveAssetStatus({
        holding: {
          movementId: 'm1',
          worker: { workerId: 'WKR-003', fullName: 'Priya Raman' },
          effectiveAt: '',
          dueAt: null,
          reservationId: null,
        },
        overdue: false,
        serviceStatus: 'out_of_service',
        ...noReservation,
      }),
    ).toBe('issued');
  });

  it('shows out of service ahead of a reservation', () => {
    expect(
      deriveAssetStatus({
        holding: null,
        overdue: false,
        serviceStatus: 'out_of_service',
        currentReservation: reservation('current', '2026-09-10T08:00:00.000Z'),
      }),
    ).toBe('out_of_service');
  });

  it('is in store when nothing else applies', () => {
    expect(
      deriveAssetStatus({
        holding: null,
        overdue: false,
        serviceStatus: 'in_service',
        ...noReservation,
      }),
    ).toBe('in_store');
  });
});

describe('countTotals', () => {
  it('counts each asset once and overdue as a subset of issued', () => {
    const issued = assembleAssetSnapshot({
      asset,
      holding: holding(null),
      serviceStatus: 'in_service',
      standingReservations: [],
      workerNames: new Map(),
      instant,
    });
    const overdue = assembleAssetSnapshot({
      asset,
      holding: holding('2026-09-10T08:00:00Z'),
      serviceStatus: 'in_service',
      standingReservations: [],
      workerNames: new Map(),
      instant,
    });
    const withdrawn = assembleAssetSnapshot({
      asset,
      holding: null,
      serviceStatus: 'out_of_service',
      standingReservations: [],
      workerNames: new Map(),
      instant,
    });
    expect(countTotals([issued, overdue, withdrawn])).toEqual({
      assets: 3,
      inStore: 0,
      issued: 2,
      overdue: 1,
      reserved: 0,
      outOfService: 1,
    });
  });
});
