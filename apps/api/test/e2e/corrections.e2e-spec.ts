import type {
  AssetHistory,
  CorrectionResult,
  MovementResult,
  Reservation,
  StoreSnapshot,
} from '@equipment-ledger/shared';
import { expectApiError } from '../support/expectations';
import {
  assetHistory,
  correctMovement,
  issueAsset,
  reserveAsset,
  returnAsset,
  storeAsOf,
} from '../support/ledger-requests';
import { readMovements } from '../support/mongo-readers';
import { instant, openTestStore, type TestStore } from '../support/test-store';

async function holderAt(store: TestStore, assetId: string, at: string): Promise<string | null> {
  const snapshot = (await storeAsOf(store, at)).body as StoreSnapshot;
  const asset = snapshot.assets.find((candidate) => candidate.asset.assetId === assetId);
  return asset?.holding?.worker.workerId ?? null;
}

describe('corrections', () => {
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

  async function returnDrill(effectiveAt: string): Promise<string> {
    const response = await returnAsset(store, {
      assetId: 'DRL-007',
      returnedByWorkerId: 'WKR-006',
      keeperId: 'KPR-02',
      effectiveAt,
    });
    expect(response.status).toBe(201);
    return (response.body as MovementResult).movement.movementId;
  }

  it('records the correction, keeps the original, and adds a replacement that carries the corrected time', async () => {
    const originalId = await returnDrill(instant(0, '11:00'));
    const response = await correctMovement(store, originalId, {
      kind: 'amend',
      reason: 'Sofia handed it in at nine, the sheet says so',
      keeperId: 'KPR-01',
      effectiveAt: instant(0, '09:00'),
    });
    expect(response.status).toBe(201);
    const result = response.body as CorrectionResult;
    expect(result.correction).toMatchObject({
      kind: 'amend',
      originalMovementId: originalId,
      changes: [{ field: 'effectiveAt', from: instant(0, '11:00'), to: instant(0, '09:00') }],
    });
    expect(result.original).toMatchObject({
      movementId: originalId,
      effectiveAt: instant(0, '11:00'),
      supersededByCorrectionId: result.correction.correctionId,
    });
    expect(result.replacement).toMatchObject({
      effectiveAt: instant(0, '09:00'),
      createdByCorrectionId: result.correction.correctionId,
    });

    const stored = await readMovements(store.connection, 'DRL-007');
    expect(
      stored.map((movement) => [
        movement.type,
        movement.effectiveAt.toISOString(),
        movement.supersededByCorrectionId !== null,
      ]),
    ).toEqual([
      ['issue', instant(-1, '07:35'), false],
      ['return', instant(0, '09:00'), false],
      ['return', instant(0, '11:00'), true],
    ]);
  });

  it('shows both the original and the correction in the asset history', async () => {
    const originalId = await returnDrill(instant(0, '11:00'));
    await correctMovement(store, originalId, {
      kind: 'amend',
      reason: 'Wrong time written down',
      keeperId: 'KPR-01',
      effectiveAt: instant(0, '09:00'),
    });

    const history = (await assetHistory(store, 'DRL-007')).body as AssetHistory;
    const returns = history.movements.filter((entry) => entry.movement.type === 'return');
    expect(returns).toHaveLength(2);
    expect(returns.map((entry) => entry.movement.supersededByCorrectionId !== null)).toEqual([
      false,
      true,
    ]);
    expect(history.corrections).toHaveLength(1);
    expect(history.corrections[0]?.reason).toBe('Wrong time written down');
  });

  it('answers historical questions with the corrected time, and the old time no longer counts', async () => {
    const originalId = await returnDrill(instant(0, '11:00'));
    expect(await holderAt(store, 'DRL-007', instant(0, '10:00'))).toBe('WKR-006');

    await correctMovement(store, originalId, {
      kind: 'amend',
      reason: 'Wrong time written down',
      keeperId: 'KPR-01',
      effectiveAt: instant(0, '09:00'),
    });
    expect(await holderAt(store, 'DRL-007', instant(0, '08:59'))).toBe('WKR-006');
    expect(await holderAt(store, 'DRL-007', instant(0, '09:00'))).toBeNull();
    expect(await holderAt(store, 'DRL-007', instant(0, '10:00'))).toBeNull();
    expect(await holderAt(store, 'DRL-007', instant(0, '11:00'))).toBeNull();
  });

  it('refuses a correction that would put the return before its issue', async () => {
    const originalId = await returnDrill(instant(0, '11:00'));
    const response = await correctMovement(store, originalId, {
      kind: 'amend',
      reason: 'Fat fingers',
      keeperId: 'KPR-01',
      effectiveAt: instant(-1, '07:00'),
    });
    expect(expectApiError(response, 422, 'correction_invalid').message).toContain('impossible');
  });

  it('refuses a correction that would move an issue on top of another holding', async () => {
    const response = await issueAsset(store, {
      assetId: 'DRL-003',
      workerId: 'WKR-001',
      keeperId: 'KPR-01',
      effectiveAt: instant(0, '07:40'),
    });
    const issueId = (response.body as MovementResult).movement.movementId;
    const conflicting = await correctMovement(store, issueId, {
      kind: 'amend',
      reason: 'Actually went out on Monday',
      keeperId: 'KPR-01',
      effectiveAt: instant(-3, '12:00'),
    });
    expectApiError(conflicting, 422, 'correction_invalid');
  });

  it('refuses to correct a movement twice and points at the replacement', async () => {
    const originalId = await returnDrill(instant(0, '11:00'));
    await correctMovement(store, originalId, {
      kind: 'amend',
      reason: 'Wrong time written down',
      keeperId: 'KPR-01',
      effectiveAt: instant(0, '09:00'),
    });
    const response = await correctMovement(store, originalId, {
      kind: 'amend',
      reason: 'Once more',
      keeperId: 'KPR-01',
      effectiveAt: instant(0, '10:00'),
    });
    expectApiError(response, 409, 'movement_already_corrected');
  });

  it('lets the replacement be corrected again, keeping the chain', async () => {
    const originalId = await returnDrill(instant(0, '11:00'));
    const first = (
      await correctMovement(store, originalId, {
        kind: 'amend',
        reason: 'First fix',
        keeperId: 'KPR-01',
        effectiveAt: instant(0, '09:00'),
      })
    ).body as CorrectionResult;
    const second = await correctMovement(store, first.replacement!.movementId, {
      kind: 'amend',
      reason: 'Second fix',
      keeperId: 'KPR-01',
      effectiveAt: instant(0, '09:30'),
    });
    expect(second.status).toBe(201);
    expect(await holderAt(store, 'DRL-007', instant(0, '09:15'))).toBe('WKR-006');
    expect(
      (await readMovements(store.connection, 'DRL-007')).filter(
        (movement) => movement.supersededByCorrectionId === null,
      ),
    ).toHaveLength(2);
  });

  it('voids a movement that never happened, so the asset is out again', async () => {
    const originalId = await returnDrill(instant(0, '11:00'));
    const response = await correctMovement(store, originalId, {
      kind: 'void',
      reason: 'That was DRL-008, not DRL-007',
      keeperId: 'KPR-01',
    });
    expect(response.status).toBe(201);
    const result = response.body as CorrectionResult;
    expect(result.correction.kind).toBe('void');
    expect(result.replacement).toBeNull();
    expect(result.asset.holding?.worker.workerId).toBe('WKR-006');
  });

  it('refuses to void an issue that has a return after it', async () => {
    const issued = await issueAsset(store, {
      assetId: 'DRL-003',
      workerId: 'WKR-001',
      keeperId: 'KPR-01',
      effectiveAt: instant(0, '07:40'),
    });
    await returnAsset(store, {
      assetId: 'DRL-003',
      returnedByWorkerId: 'WKR-001',
      keeperId: 'KPR-01',
      effectiveAt: instant(0, '11:00'),
    });
    const response = await correctMovement(
      store,
      (issued.body as MovementResult).movement.movementId,
      { kind: 'void', reason: 'Never went out', keeperId: 'KPR-01' },
    );
    expectApiError(response, 422, 'correction_invalid');
  });

  it('checks the certificate again when the worker on an issue is corrected', async () => {
    const issued = await issueAsset(store, {
      assetId: 'GAS-004',
      workerId: 'WKR-005',
      keeperId: 'KPR-01',
      effectiveAt: instant(0, '07:40'),
    });
    const response = await correctMovement(
      store,
      (issued.body as MovementResult).movement.movementId,
      {
        kind: 'amend',
        reason: 'It was Liam, not Daniel',
        keeperId: 'KPR-01',
        workerId: 'WKR-007',
      },
    );
    expectApiError(response, 422, 'certification_expired');
  });

  it('refuses a correction that changes nothing', async () => {
    const originalId = await returnDrill(instant(0, '11:00'));
    const response = await correctMovement(store, originalId, {
      kind: 'amend',
      reason: 'Just checking',
      keeperId: 'KPR-01',
      effectiveAt: instant(0, '11:00'),
    });
    expectApiError(response, 422, 'correction_invalid');
  });

  describe('when the corrected movement collected a reservation', () => {
    async function issueAgainstReservation(): Promise<{
      movementId: string;
      reservationId: string;
    }> {
      const created = await reserveAsset(store, {
        assetId: 'LAD-003',
        workerId: 'WKR-008',
        keeperId: 'KPR-01',
        startsAt: instant(1, '08:00'),
        endsAt: instant(1, '16:00'),
      });
      const reservationId = (created.body as Reservation).reservationId;
      store.clock.set(new Date(instant(1, '08:10')));
      const issued = await issueAsset(store, {
        assetId: 'LAD-003',
        workerId: 'WKR-008',
        keeperId: 'KPR-01',
        effectiveAt: instant(1, '08:05'),
      });
      expect(issued.status).toBe(201);
      const movement = (issued.body as MovementResult).movement;
      expect(movement.reservationId).toBe(reservationId);
      return { movementId: movement.movementId, reservationId };
    }

    it("moves the reservation's link onto the replacement, not the superseded movement", async () => {
      const { movementId, reservationId } = await issueAgainstReservation();
      const corrected = await correctMovement(store, movementId, {
        kind: 'amend',
        reason: 'It went out a few minutes earlier',
        keeperId: 'KPR-01',
        effectiveAt: instant(1, '08:02'),
      });
      expect(corrected.status).toBe(201);
      const replacementId = (corrected.body as CorrectionResult).replacement?.movementId;

      const reservations = (await store.http.get('/reservations').query({ assetId: 'LAD-003' }))
        .body as Reservation[];
      const reservation = reservations.find(
        (candidate) => candidate.reservationId === reservationId,
      );
      expect(reservation).toMatchObject({
        status: 'fulfilled',
        fulfilledByMovementId: replacementId,
      });
    });

    it('hands the reservation back when the correction names a different worker', async () => {
      const { movementId, reservationId } = await issueAgainstReservation();
      const corrected = await correctMovement(store, movementId, {
        kind: 'amend',
        reason: 'Sofia took it, not Hana',
        keeperId: 'KPR-01',
        workerId: 'WKR-006',
      });
      expect(corrected.status).toBe(201);
      expect((corrected.body as CorrectionResult).replacement).toMatchObject({
        workerId: 'WKR-006',
        reservationId: null,
      });

      const reservations = (await store.http.get('/reservations').query({ assetId: 'LAD-003' }))
        .body as Reservation[];
      const reservation = reservations.find(
        (candidate) => candidate.reservationId === reservationId,
      );
      expect(reservation).toMatchObject({
        workerId: 'WKR-008',
        status: 'active',
        fulfilledByMovementId: null,
      });
    });

    it('hands the reservation back when the movement is voided', async () => {
      const { movementId, reservationId } = await issueAgainstReservation();
      const voided = await correctMovement(store, movementId, {
        kind: 'void',
        reason: 'Never actually left the store',
        keeperId: 'KPR-01',
      });
      expect(voided.status).toBe(201);

      const reservations = (await store.http.get('/reservations').query({ assetId: 'LAD-003' }))
        .body as Reservation[];
      expect(
        reservations.find((candidate) => candidate.reservationId === reservationId),
      ).toMatchObject({
        status: 'active',
        fulfilledByMovementId: null,
      });
    });
  });

  it('refuses a correction without a reason', async () => {
    const originalId = await returnDrill(instant(0, '11:00'));
    const response = await store.http
      .post(`/movements/${originalId}/corrections`)
      .set('idempotency-key', 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeef')
      .send({ kind: 'amend', keeperId: 'KPR-01', effectiveAt: instant(0, '10:00') });
    expect(expectApiError(response, 400, 'validation_failed').message).toContain('reason');
  });
});
