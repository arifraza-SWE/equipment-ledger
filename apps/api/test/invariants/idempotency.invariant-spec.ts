import type { MovementResult } from '@equipment-ledger/shared';
import { correctMovement, issueAsset, reserveAsset, returnAsset } from '../support/ledger-requests';
import { readMovements, readReservations } from '../support/mongo-readers';
import { idempotencyKey, instant, openTestStore, type TestStore } from '../support/test-store';

describe('invariant: repeating a request never lands it twice', () => {
  let store: TestStore;

  beforeAll(async () => {
    store = await openTestStore();
  });

  afterAll(async () => {
    await store.close();
  });

  it('issue, return, correction and reservation each land once under sequential and simultaneous repeats', async () => {
    const issueKey = idempotencyKey();
    const issueRequest = {
      assetId: 'DRL-003',
      workerId: 'WKR-001',
      keeperId: 'KPR-01',
      effectiveAt: instant(0, '07:40'),
    };
    for (let repeat = 0; repeat < 5; repeat += 1) {
      await issueAsset(store, issueRequest, issueKey);
    }
    await Promise.all(Array.from({ length: 8 }, () => issueAsset(store, issueRequest, issueKey)));

    const returnKey = idempotencyKey();
    const returnRequest = {
      assetId: 'DRL-003',
      returnedByWorkerId: 'WKR-001',
      keeperId: 'KPR-01',
      effectiveAt: instant(0, '11:00'),
    };
    const firstReturn = await returnAsset(store, returnRequest, returnKey);
    await Promise.all(
      Array.from({ length: 8 }, () => returnAsset(store, returnRequest, returnKey)),
    );

    const correctionKey = idempotencyKey();
    const returnMovementId = (firstReturn.body as MovementResult).movement.movementId;
    const correctionRequest = {
      kind: 'amend' as const,
      reason: 'Wrong time',
      keeperId: 'KPR-01',
      effectiveAt: instant(0, '10:30'),
    };
    await Promise.all(
      Array.from({ length: 8 }, () =>
        correctMovement(store, returnMovementId, correctionRequest, correctionKey),
      ),
    );

    const reservationKey = idempotencyKey();
    const reservationRequest = {
      assetId: 'DRL-003',
      workerId: 'WKR-006',
      keeperId: 'KPR-01',
      startsAt: instant(1, '08:00'),
      endsAt: instant(1, '12:00'),
    };
    await Promise.all(
      Array.from({ length: 8 }, () => reserveAsset(store, reservationRequest, reservationKey)),
    );

    const movements = await readMovements(store.connection, 'DRL-003');
    const today = movements.filter(
      (movement) => movement.effectiveAt.getTime() >= new Date(instant(0, '00:00')).getTime(),
    );
    expect(
      today.map((movement) => [movement.type, movement.supersededByCorrectionId !== null]),
    ).toEqual([
      ['issue', false],
      ['return', false],
      ['return', true],
    ]);
    expect(
      await store.connection.collection('corrections').countDocuments({ assetId: 'DRL-003' }),
    ).toBe(1);
    expect(
      (await readReservations(store.connection, 'DRL-003')).filter(
        (reservation) => reservation.startsAt.toISOString() === reservationRequest.startsAt,
      ),
    ).toHaveLength(1);
  });
});
