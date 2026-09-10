import type {
  AssetSnapshot,
  Reservation,
  ServiceStatusChangeResult,
} from '@equipment-ledger/shared';
import { expectApiError } from '../support/expectations';
import {
  assetNow,
  changeServiceStatus,
  issueAsset,
  reserveAsset,
  returnAsset,
} from '../support/ledger-requests';
import { readEffectiveMovements } from '../support/mongo-readers';
import {
  idempotencyKey,
  instant,
  openTestStore,
  TEST_NOW,
  type TestStore,
} from '../support/test-store';
import { STALE_CLAIM_AFTER_MS } from '../../src/common/idempotency/idempotency.service';

describe('taking an asset out of service and bringing it back', () => {
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

  const withdrawnAt = instant(0, '10:00');
  const withdrawal = {
    status: 'out_of_service' as const,
    keeperId: 'KPR-01',
    reason: 'Cracked housing',
    effectiveAt: withdrawnAt,
  };

  it('records the withdrawal as a dated, written-down fact', async () => {
    const response = await changeServiceStatus(store, 'DRL-003', withdrawal);
    expect(response.status).toBe(201);
    const result = response.body as ServiceStatusChangeResult;
    expect(result.movement).toMatchObject({
      assetId: 'DRL-003',
      type: 'out_of_service',
      keeperId: 'KPR-01',
      note: 'Cracked housing',
      effectiveAt: withdrawnAt,
      recordedAt: TEST_NOW.toISOString(),
    });
    expect(result.asset.serviceStatus).toBe('out_of_service');
    expect(result.asset.status).toBe('out_of_service');
  });

  it('refuses to issue or reserve it afterwards', async () => {
    await changeServiceStatus(store, 'DRL-003', withdrawal);

    const issue = await issueAsset(store, {
      assetId: 'DRL-003',
      workerId: 'WKR-006',
      keeperId: 'KPR-01',
      effectiveAt: instant(0, '11:00'),
    });
    expectApiError(issue, 422, 'asset_out_of_service');
    expect((issue.body as { message: string }).message).toContain('out of service');

    const reservation = await reserveAsset(store, {
      assetId: 'DRL-003',
      workerId: 'WKR-006',
      keeperId: 'KPR-01',
      startsAt: instant(1, '08:00'),
      endsAt: instant(1, '12:00'),
    });
    expectApiError(reservation, 422, 'asset_out_of_service');
  });

  describe('while the asset is issued', () => {
    it('leaves the holding open, because the worker still has it', async () => {
      const response = await changeServiceStatus(store, 'HARN-003', {
        status: 'out_of_service',
        keeperId: 'KPR-01',
        reason: 'Stitching frayed on the dorsal ring',
        effectiveAt: withdrawnAt,
      });
      expect(response.status).toBe(201);
      const asset = (response.body as ServiceStatusChangeResult).asset;
      expect(asset.serviceStatus).toBe('out_of_service');
      expect(asset.holding?.worker.workerId).toBe('WKR-004');
      expect(asset.status).toBe('overdue');
    });

    it('still accepts the return, and the asset stays out of service', async () => {
      await changeServiceStatus(store, 'HARN-003', {
        status: 'out_of_service',
        keeperId: 'KPR-01',
        reason: 'Stitching frayed on the dorsal ring',
        effectiveAt: withdrawnAt,
      });
      const returned = await returnAsset(store, {
        assetId: 'HARN-003',
        returnedByWorkerId: 'WKR-004',
        keeperId: 'KPR-01',
        effectiveAt: instant(0, '11:00'),
      });
      expect(returned.status).toBe(201);

      const asset = (await assetNow(store, 'HARN-003')).body as AssetSnapshot;
      expect(asset).toMatchObject({
        status: 'out_of_service',
        serviceStatus: 'out_of_service',
        holding: null,
      });
    });
  });

  describe('while the asset is reserved', () => {
    it('voids the standing reservations and says why, without deleting them', async () => {
      const response = await changeServiceStatus(store, 'TWR-001', {
        status: 'out_of_service',
        keeperId: 'KPR-01',
        reason: 'Missing toe boards',
        effectiveAt: withdrawnAt,
      });
      expect(response.status).toBe(201);
      const voided = (response.body as ServiceStatusChangeResult).voidedReservations;
      expect(voided).toHaveLength(1);
      expect(voided[0]).toMatchObject({
        assetId: 'TWR-001',
        workerId: 'WKR-003',
        status: 'voided',
        closedReason: 'Asset taken out of service',
      });

      const stored = (await store.http.get('/reservations').query({ assetId: 'TWR-001' }))
        .body as Reservation[];
      expect(stored).toHaveLength(1);
      expect(stored[0]).toMatchObject({ status: 'voided', standing: null });
    });

    it('does not restore them when the asset comes back into service', async () => {
      await changeServiceStatus(store, 'TWR-001', {
        status: 'out_of_service',
        keeperId: 'KPR-01',
        reason: 'Missing toe boards',
        effectiveAt: withdrawnAt,
      });
      const restored = await changeServiceStatus(store, 'TWR-001', {
        status: 'in_service',
        keeperId: 'KPR-02',
        reason: 'Toe boards replaced',
        effectiveAt: instant(0, '10:30'),
      });
      expect(restored.status).toBe(201);
      expect((restored.body as ServiceStatusChangeResult).asset.status).toBe('in_store');

      const stored = (await store.http.get('/reservations').query({ assetId: 'TWR-001' }))
        .body as Reservation[];
      expect(stored[0]?.status).toBe('voided');
    });
  });

  it('refuses to withdraw an asset that is already out of service', async () => {
    const response = await changeServiceStatus(store, 'GAS-002', withdrawal);
    expectApiError(response, 409, 'asset_already_out_of_service');
  });

  it('refuses to restore an asset that is already in service', async () => {
    const response = await changeServiceStatus(store, 'DRL-003', {
      status: 'in_service',
      keeperId: 'KPR-01',
      reason: 'Nothing was wrong with it',
      effectiveAt: withdrawnAt,
    });
    expectApiError(response, 409, 'asset_already_in_service');
  });

  it('brings a withdrawn asset back and lets it go out again', async () => {
    const restored = await changeServiceStatus(store, 'GAS-002', {
      status: 'in_service',
      keeperId: 'KPR-02',
      reason: 'Calibrated and bump tested',
      effectiveAt: withdrawnAt,
    });
    expect(restored.status).toBe(201);

    const issued = await issueAsset(store, {
      assetId: 'GAS-002',
      workerId: 'WKR-005',
      keeperId: 'KPR-01',
      effectiveAt: instant(0, '11:00'),
    });
    expect(issued.status).toBe(201);

    const timeline = await readEffectiveMovements(store.connection, 'GAS-002');
    expect(timeline.slice(-3).map((movement) => movement.type)).toEqual([
      'out_of_service',
      'back_in_service',
      'issue',
    ]);
  });

  it('refuses a withdrawal dated in the future', async () => {
    const response = await changeServiceStatus(store, 'DRL-003', {
      ...withdrawal,
      effectiveAt: instant(0, '23:00'),
    });
    expectApiError(response, 422, 'timeline_conflict');
  });

  it('demands a reason and an effective time', async () => {
    const response = await store.http
      .post('/assets/DRL-003/service-status')
      .set('idempotency-key', 'bbbbbbbb-cccc-dddd-eeee-ffffffffffff')
      .send({ status: 'out_of_service', keeperId: 'KPR-01' });
    const error = expectApiError(response, 400, 'validation_failed');
    expect(error.message).toContain('reason');
    expect(error.message).toContain('effectiveAt');
  });

  it('refuses a second execution even after the asset has been round-tripped in between', async () => {
    const key = idempotencyKey();
    const withdrawn = await changeServiceStatus(store, 'DRL-003', withdrawal, key);
    expect(withdrawn.status).toBe(201);

    const restored = await changeServiceStatus(store, 'DRL-003', {
      status: 'in_service',
      keeperId: 'KPR-02',
      reason: 'Chuck was fine after all',
      effectiveAt: instant(0, '10:30'),
    });
    expect(restored.status).toBe(201);

    // The API died between committing the withdrawal and marking the key done, so the claim
    // still reads as in progress; the keeper retries once it looks abandoned.
    await store.connection
      .collection('idempotency_records')
      .updateOne(
        { _id: key as unknown as never },
        { $set: { status: 'in_progress', response: null, completedAt: null } },
      );
    store.clock.set(new Date(TEST_NOW.getTime() + STALE_CLAIM_AFTER_MS + 60_000));

    const retried = await changeServiceStatus(store, 'DRL-003', withdrawal, key);
    expect(retried.status).toBe(422);

    const withdrawals = (await readEffectiveMovements(store.connection, 'DRL-003')).filter(
      (movement) => movement.type === 'out_of_service',
    );
    expect(withdrawals).toHaveLength(1);
    expect(withdrawals[0]?.effectiveAt.toISOString()).toBe(withdrawnAt);
  });

  it('returns 404 for an asset the store does not have', async () => {
    const response = await changeServiceStatus(store, 'NOPE-001', withdrawal);
    expectApiError(response, 404, 'not_found');
  });
});
