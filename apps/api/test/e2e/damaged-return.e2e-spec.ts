import type { CorrectionResult, MovementResult, Reservation } from '@equipment-ledger/shared';
import { expectApiError } from '../support/expectations';
import {
  changeServiceStatus,
  correctMovement,
  issueAsset,
  reserveAsset,
  returnAsset,
  storeAsOf,
} from '../support/ledger-requests';
import { readEffectiveMovements, readReservations } from '../support/mongo-readers';
import { instant, openTestStore, type TestStore } from '../support/test-store';

describe('an asset that comes back damaged', () => {
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

  async function issueDrill(): Promise<void> {
    const issued = await issueAsset(store, {
      assetId: 'DRL-001',
      workerId: 'WKR-001',
      keeperId: 'KPR-01',
      effectiveAt: instant(0, '08:00'),
    });
    expect(issued.status).toBe(201);
  }

  it('refuses to withdraw an asset the ledger already has out of service', async () => {
    await issueDrill();
    const withdrawn = await changeServiceStatus(store, 'DRL-001', {
      status: 'out_of_service',
      keeperId: 'KPR-01',
      reason: 'Found broken on the bench',
      effectiveAt: instant(0, '09:00'),
    });
    expect(withdrawn.status).toBe(201);

    const returned = await returnAsset(store, {
      assetId: 'DRL-001',
      returnedByWorkerId: 'WKR-001',
      keeperId: 'KPR-01',
      effectiveAt: instant(0, '10:00'),
      takeOutOfService: true,
      note: 'Casing cracked',
    });
    expectApiError(returned, 409, 'asset_already_out_of_service');

    const withdrawals = (await readEffectiveMovements(store.connection, 'DRL-001')).filter(
      (movement) => movement.type === 'out_of_service',
    );
    expect(withdrawals).toHaveLength(1);
  });

  it('accepts a return backdated before a withdrawal already on the service track', async () => {
    await issueDrill();
    await changeServiceStatus(store, 'DRL-001', {
      status: 'out_of_service',
      keeperId: 'KPR-01',
      reason: 'Found broken on the bench',
      effectiveAt: instant(0, '10:00'),
    });

    const returned = await returnAsset(store, {
      assetId: 'DRL-001',
      returnedByWorkerId: 'WKR-001',
      keeperId: 'KPR-01',
      effectiveAt: instant(0, '09:00'),
    });
    expect(returned.status).toBe(201);

    const timeline = await readEffectiveMovements(store.connection, 'DRL-001');
    expect(timeline.map((movement) => movement.type)).toEqual([
      'issue',
      'return',
      'out_of_service',
    ]);
  });

  describe('when the return and the withdrawal were written together', () => {
    async function returnDamaged(): Promise<string> {
      await issueDrill();
      const returned = await returnAsset(store, {
        assetId: 'DRL-001',
        returnedByWorkerId: 'WKR-001',
        keeperId: 'KPR-01',
        effectiveAt: instant(0, '10:00'),
        takeOutOfService: true,
        note: 'Casing cracked',
      });
      expect(returned.status).toBe(201);
      return (returned.body as MovementResult).movement.movementId;
    }

    it('moves the withdrawal with the return when the return time is corrected', async () => {
      const returnMovementId = await returnDamaged();
      const corrected = await correctMovement(store, returnMovementId, {
        kind: 'amend',
        reason: 'It came back at half eleven',
        keeperId: 'KPR-01',
        effectiveAt: instant(0, '11:30'),
      });
      expect(corrected.status).toBe(201);

      const timeline = await readEffectiveMovements(store.connection, 'DRL-001');
      expect(
        timeline.map((movement) => [movement.type, movement.effectiveAt.toISOString()]),
      ).toEqual([
        ['issue', instant(0, '08:00')],
        ['return', instant(0, '11:30')],
        ['out_of_service', instant(0, '11:30')],
      ]);
    });

    it('never leaves the asset condemned while somebody still held it', async () => {
      const returnMovementId = await returnDamaged();
      await correctMovement(store, returnMovementId, {
        kind: 'amend',
        reason: 'It came back at half eleven',
        keeperId: 'KPR-01',
        effectiveAt: instant(0, '11:30'),
      });

      const midday = await storeAsOf(store, instant(0, '11:00'));
      const drill = (midday.body as { assets: Array<Record<string, unknown>> }).assets.find(
        (asset) => (asset.asset as { assetId: string }).assetId === 'DRL-001',
      );
      expect(drill).toMatchObject({ serviceStatus: 'in_service' });
      expect((drill as { holding: { worker: { workerId: string } } }).holding.worker.workerId).toBe(
        'WKR-001',
      );
    });

    it('voids the withdrawal too when the return is voided', async () => {
      const returnMovementId = await returnDamaged();
      const voided = await correctMovement(store, returnMovementId, {
        kind: 'void',
        reason: 'That was DRL-002, wrong drill',
        keeperId: 'KPR-01',
      });
      expect(voided.status).toBe(201);
      expect((voided.body as CorrectionResult).asset).toMatchObject({
        serviceStatus: 'in_service',
        status: 'issued',
      });

      const timeline = await readEffectiveMovements(store.connection, 'DRL-001');
      expect(timeline.map((movement) => movement.type)).toEqual(['issue']);
    });
  });

  it('gives back the reservations a withdrawal voided when that withdrawal is voided', async () => {
    const reserved = await reserveAsset(store, {
      assetId: 'DRL-001',
      workerId: 'WKR-006',
      keeperId: 'KPR-01',
      startsAt: instant(1, '08:00'),
      endsAt: instant(1, '16:00'),
    });
    expect(reserved.status).toBe(201);
    const reservationId = (reserved.body as Reservation).reservationId;

    const withdrawn = await changeServiceStatus(store, 'DRL-001', {
      status: 'out_of_service',
      keeperId: 'KPR-01',
      reason: 'Scanned the wrong asset',
      effectiveAt: instant(0, '09:00'),
    });
    expect(withdrawn.status).toBe(201);
    expect(
      (withdrawn.body as { voidedReservations: Reservation[] }).voidedReservations,
    ).toHaveLength(1);

    const withdrawalId = (withdrawn.body as { movement: { movementId: string } }).movement
      .movementId;
    const voided = await correctMovement(store, withdrawalId, {
      kind: 'void',
      reason: 'Wrong asset; DRL-001 is fine',
      keeperId: 'KPR-01',
    });
    expect(voided.status).toBe(201);

    const reinstated = (await readReservations(store.connection, 'DRL-001')).find((reservation) =>
      reservation._id.equals(reservationId),
    );
    expect(reinstated).toMatchObject({ status: 'active', closedAt: null, closedReason: null });
  });
});
