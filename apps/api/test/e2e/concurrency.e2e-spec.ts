import type { CorrectionResult, MovementResult } from '@equipment-ledger/shared';
import {
  findTimelineViolation,
  sortTimeline,
} from '../../src/modules/ledger/domain/asset-timeline';
import { toTimelineEntry } from '../../src/modules/ledger/persistence/movements.repository';
import { correctMovement, issueAsset, reserveAsset, returnAsset } from '../support/ledger-requests';
import { countIssuesAt, readEffectiveMovements, readReservations } from '../support/mongo-readers';
import { instant, openTestStore, type TestStore } from '../support/test-store';

const CERTIFIED_FOR_HARNESS = ['WKR-001', 'WKR-002', 'WKR-003', 'WKR-005', 'WKR-012'];

describe('simultaneous requests', () => {
  let store: TestStore;

  beforeAll(async () => {
    store = await openTestStore();
  });

  afterAll(async () => {
    await store.close();
  });

  beforeEach(async () => {
    await store.reseed();
  });

  it('lets exactly one of twenty-five simultaneous issues of HARN-014 through', async () => {
    const effectiveAt = instant(0, '07:45');
    const responses = await Promise.all(
      Array.from({ length: 25 }, (_, index) =>
        issueAsset(store, {
          assetId: 'HARN-014',
          workerId: CERTIFIED_FOR_HARNESS[index % CERTIFIED_FOR_HARNESS.length]!,
          keeperId: 'KPR-02',
          effectiveAt,
        }),
      ),
    );

    const successes = responses.filter((response) => response.status === 201);
    const refusals = responses.filter((response) => response.status === 409);
    expect(successes).toHaveLength(1);
    expect(refusals).toHaveLength(24);
    for (const refusal of refusals) {
      expect(refusal.body).toMatchObject({ code: 'asset_already_issued' });
    }

    const winner = (successes[0]!.body as MovementResult).movement.workerId;
    for (const refusal of refusals) {
      expect((refusal.body as { message: string }).message).toContain(winner!);
    }
    expect(await countIssuesAt(store.connection, 'HARN-014', effectiveAt)).toBe(1);

    const timeline = (await readEffectiveMovements(store.connection, 'HARN-014')).map(
      toTimelineEntry,
    );
    expect(findTimelineViolation(sortTimeline(timeline))).toBeNull();
  });

  it('holds the same guarantee for issues at different effective times', async () => {
    const responses = await Promise.all(
      Array.from({ length: 10 }, (_, index) =>
        issueAsset(store, {
          assetId: 'DRL-003',
          workerId: index % 2 === 0 ? 'WKR-006' : 'WKR-008',
          keeperId: 'KPR-02',
          effectiveAt: instant(0, `07:${String(30 + index).padStart(2, '0')}`),
        }),
      ),
    );
    expect(responses.filter((response) => response.status === 201)).toHaveLength(1);
    const timeline = (await readEffectiveMovements(store.connection, 'DRL-003')).map(
      toTimelineEntry,
    );
    expect(timeline.filter((entry) => entry.type === 'issue').length).toBe(
      timeline.filter((entry) => entry.type === 'return').length + 1,
    );
  });

  it('records one return when two keepers return the same asset at once', async () => {
    const responses = await Promise.all([
      returnAsset(store, {
        assetId: 'DRL-007',
        returnedByWorkerId: 'WKR-006',
        keeperId: 'KPR-01',
        effectiveAt: instant(0, '11:00'),
      }),
      returnAsset(store, {
        assetId: 'DRL-007',
        returnedByWorkerId: 'WKR-006',
        keeperId: 'KPR-02',
        effectiveAt: instant(0, '11:05'),
      }),
      returnAsset(store, {
        assetId: 'DRL-007',
        returnedByWorkerId: 'WKR-006',
        keeperId: 'KPR-03',
        effectiveAt: instant(0, '11:10'),
      }),
    ]);
    expect(responses.filter((response) => response.status === 201)).toHaveLength(1);
    expect(
      (await readEffectiveMovements(store.connection, 'DRL-007')).filter(
        (movement) => movement.type === 'return',
      ),
    ).toHaveLength(1);
  });

  it('lets exactly one of ten overlapping reservations through', async () => {
    const responses = await Promise.all(
      Array.from({ length: 10 }, (_, index) =>
        reserveAsset(store, {
          assetId: 'LVL-003',
          workerId: index % 2 === 0 ? 'WKR-006' : 'WKR-011',
          keeperId: 'KPR-01',
          startsAt: instant(1, `08:${String(index * 5).padStart(2, '0')}`),
          endsAt: instant(1, '12:00'),
        }),
      ),
    );
    expect(responses.filter((response) => response.status === 201)).toHaveLength(1);
    expect(responses.filter((response) => response.status === 409)).toHaveLength(9);
    const reservations = await readReservations(store.connection, 'LVL-003');
    expect(reservations.filter((reservation) => reservation.status === 'active')).toHaveLength(1);
  });

  it('applies one of six simultaneous corrections to the same movement', async () => {
    const returned = await returnAsset(store, {
      assetId: 'DRL-007',
      returnedByWorkerId: 'WKR-006',
      keeperId: 'KPR-01',
      effectiveAt: instant(0, '11:00'),
    });
    const movementId = (returned.body as MovementResult).movement.movementId;
    const responses = await Promise.all(
      Array.from({ length: 6 }, (_, index) =>
        correctMovement(store, movementId, {
          kind: 'amend',
          reason: `Keeper ${index} remembers it differently`,
          keeperId: 'KPR-01',
          effectiveAt: instant(0, `10:${String(10 + index).padStart(2, '0')}`),
        }),
      ),
    );
    const applied = responses.filter((response) => response.status === 201);
    expect(applied).toHaveLength(1);
    expect(responses.filter((response) => response.status === 409)).toHaveLength(5);
    const effective = await readEffectiveMovements(store.connection, 'DRL-007');
    expect(effective.filter((movement) => movement.type === 'return')).toHaveLength(1);
    expect(
      effective.find((movement) => movement.type === 'return')?.effectiveAt.toISOString(),
    ).toBe((applied[0]!.body as CorrectionResult).replacement!.effectiveAt);
  });
});
