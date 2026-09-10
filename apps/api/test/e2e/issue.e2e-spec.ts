import type { AssetSnapshot, MovementResult, Reservation } from '@equipment-ledger/shared';
import { expectApiError } from '../support/expectations';
import { assetNow, issueAsset, reserveAsset } from '../support/ledger-requests';
import { countIssuesAt } from '../support/mongo-readers';
import { instant, openTestStore, TEST_NOW, type TestStore } from '../support/test-store';

describe('issuing an asset', () => {
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

  it('records the issue with the effective time the keeper typed and the recorded time from the server clock', async () => {
    const effectiveAt = instant(0, '07:40');
    const response = await issueAsset(store, {
      assetId: 'DRL-003',
      workerId: 'WKR-001',
      keeperId: 'KPR-01',
      effectiveAt,
    });

    expect(response.status).toBe(201);
    const result = response.body as MovementResult;
    expect(result.movement).toMatchObject({
      assetId: 'DRL-003',
      type: 'issue',
      workerId: 'WKR-001',
      keeperId: 'KPR-01',
      effectiveAt,
      recordedAt: TEST_NOW.toISOString(),
    });
    expect(result.asset.status).toBe('issued');
    expect(result.asset.holding?.worker).toEqual({ workerId: 'WKR-001', fullName: 'Amira Haddad' });
    expect(await countIssuesAt(store.connection, 'DRL-003', effectiveAt)).toBe(1);
  });

  it('defaults the due time to eight hours after the issue', async () => {
    const response = await issueAsset(store, {
      assetId: 'DRL-003',
      workerId: 'WKR-001',
      keeperId: 'KPR-01',
      effectiveAt: instant(0, '07:40'),
    });
    expect((response.body as MovementResult).movement.dueAt).toBe(instant(0, '15:40'));
  });

  it('refuses an asset that is already held and names the holder', async () => {
    await issueAsset(store, {
      assetId: 'DRL-003',
      workerId: 'WKR-001',
      keeperId: 'KPR-01',
      effectiveAt: instant(0, '07:40'),
    });
    const response = await issueAsset(store, {
      assetId: 'DRL-003',
      workerId: 'WKR-002',
      keeperId: 'KPR-01',
      effectiveAt: instant(0, '08:00'),
    });
    const error = expectApiError(response, 409, 'asset_already_issued');
    expect(error.message).toContain('Amira Haddad (WKR-001)');
    expect(await countIssuesAt(store.connection, 'DRL-003', instant(0, '08:00'))).toBe(0);
  });

  it('refuses a seeded holding too: HARN-003 is with Callum Reid', async () => {
    const response = await issueAsset(store, {
      assetId: 'HARN-003',
      workerId: 'WKR-001',
      keeperId: 'KPR-01',
      effectiveAt: instant(0, '07:40'),
    });
    expect(expectApiError(response, 409, 'asset_already_issued').message).toContain(
      'Callum Reid (WKR-004)',
    );
  });

  describe('certificates', () => {
    it('refuses a worker whose certificate expired yesterday, with the expiry date', async () => {
      const response = await issueAsset(store, {
        assetId: 'GAS-004',
        workerId: 'WKR-007',
        keeperId: 'KPR-01',
        effectiveAt: instant(0, '07:40'),
      });
      const error = expectApiError(response, 422, 'certification_expired');
      expect(error.message).toBe(
        'Liam Doherty (WKR-007) cannot receive GAS-004 because the required Gas Detection certification expired on 2026-09-09.',
      );
    });

    it('accepts a worker whose certificate is valid', async () => {
      const response = await issueAsset(store, {
        assetId: 'GAS-004',
        workerId: 'WKR-005',
        keeperId: 'KPR-01',
        effectiveAt: instant(0, '07:40'),
      });
      expect(response.status).toBe(201);
    });

    it('refuses a worker with no certificate of the required type', async () => {
      const response = await issueAsset(store, {
        assetId: 'HARN-014',
        workerId: 'WKR-006',
        keeperId: 'KPR-01',
        effectiveAt: instant(0, '07:40'),
      });
      expect(expectApiError(response, 422, 'certification_missing').message).toContain(
        'Working at Height',
      );
    });

    it('judges the certificate at the effective time: a backdated issue from yesterday morning still passes', async () => {
      const response = await issueAsset(store, {
        assetId: 'GAS-004',
        workerId: 'WKR-007',
        keeperId: 'KPR-01',
        effectiveAt: instant(-1, '07:40'),
      });
      expect(response.status).toBe(201);
      expect((response.body as MovementResult).movement).toMatchObject({
        workerId: 'WKR-007',
        effectiveAt: instant(-1, '07:40'),
      });
    });

    it('accepts a certificate that expires later today, since it still covers the issue instant', async () => {
      store.clock.set(new Date(instant(3, '12:00')));
      const response = await issueAsset(store, {
        assetId: 'HARN-014',
        workerId: 'WKR-004',
        keeperId: 'KPR-01',
        effectiveAt: instant(3, '11:00'),
      });
      expect(response.status).toBe(201);
    });

    it('refuses the same worker the day after the certificate lapsed', async () => {
      store.clock.set(new Date(instant(4, '12:00')));
      const response = await issueAsset(store, {
        assetId: 'HARN-014',
        workerId: 'WKR-004',
        keeperId: 'KPR-01',
        effectiveAt: instant(4, '11:00'),
      });
      expectApiError(response, 422, 'certification_expired');
    });
  });

  it('refuses an asset that is out of service', async () => {
    const response = await issueAsset(store, {
      assetId: 'GAS-002',
      workerId: 'WKR-005',
      keeperId: 'KPR-01',
      effectiveAt: instant(0, '07:40'),
    });
    expect(expectApiError(response, 422, 'asset_out_of_service').message).toContain(
      'out of service',
    );
  });

  it('refuses an effective time in the future', async () => {
    const response = await issueAsset(store, {
      assetId: 'DRL-003',
      workerId: 'WKR-001',
      keeperId: 'KPR-01',
      effectiveAt: instant(0, '13:00'),
    });
    expectApiError(response, 422, 'timeline_conflict');
  });

  it('refuses an issue slotted before a later entry on the same asset', async () => {
    const response = await issueAsset(store, {
      assetId: 'DRL-003',
      workerId: 'WKR-001',
      keeperId: 'KPR-01',
      effectiveAt: instant(-3, '12:00'),
    });
    expect(expectApiError(response, 422, 'timeline_conflict').message).toContain('later entry');
  });

  it('accepts a backdated issue after the last entry', async () => {
    const response = await issueAsset(store, {
      assetId: 'DRL-003',
      workerId: 'WKR-001',
      keeperId: 'KPR-01',
      effectiveAt: instant(-1, '07:40'),
    });
    expect(response.status).toBe(201);
    expect((response.body as MovementResult).movement.recordedAt).toBe(TEST_NOW.toISOString());
  });

  it('returns 404 for an unknown asset, worker or keeper', async () => {
    const missingAsset = await issueAsset(store, {
      assetId: 'DRL-999',
      workerId: 'WKR-001',
      keeperId: 'KPR-01',
      effectiveAt: instant(0, '07:40'),
    });
    expectApiError(missingAsset, 404, 'not_found');
    const missingWorker = await issueAsset(store, {
      assetId: 'DRL-003',
      workerId: 'WKR-999',
      keeperId: 'KPR-01',
      effectiveAt: instant(0, '07:40'),
    });
    expectApiError(missingWorker, 404, 'not_found');
    const missingKeeper = await issueAsset(store, {
      assetId: 'DRL-003',
      workerId: 'WKR-001',
      keeperId: 'KPR-99',
      effectiveAt: instant(0, '07:40'),
    });
    expectApiError(missingKeeper, 404, 'not_found');
  });

  it('rejects malformed bodies with field-level messages', async () => {
    const response = await store.http
      .post('/movements/issues')
      .set('idempotency-key', 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee')
      .send({
        assetId: 'drl 3',
        workerId: 'WKR-001',
        keeperId: 'KPR-01',
        effectiveAt: '2026-09-10 07:40',
        surprise: true,
      });
    const error = expectApiError(response, 400, 'validation_failed');
    expect(error.message).toContain('assetId');
    expect(error.message).toContain('effectiveAt');
    expect(error.message).toContain('surprise');
  });

  describe('against a reservation', () => {
    it("collects the worker's own reservation and marks it fulfilled", async () => {
      store.clock.set(new Date(instant(1, '08:10')));
      const response = await issueAsset(store, {
        assetId: 'HARN-002',
        workerId: 'WKR-002',
        keeperId: 'KPR-01',
        effectiveAt: instant(1, '08:05'),
      });
      expect(response.status).toBe(201);
      const result = response.body as MovementResult;
      expect(result.movement.reservationId).not.toBeNull();
      expect(result.movement.dueAt).toBe(instant(1, '16:00'));

      const reservations = await store.http.get('/reservations').query({ assetId: 'HARN-002' });
      const fulfilled = (reservations.body as Reservation[]).find(
        (reservation) => reservation.status === 'fulfilled',
      );
      expect(fulfilled?.fulfilledByMovementId).toBe(result.movement.movementId);
    });

    it("refuses to issue an asset to somebody else inside another worker's window", async () => {
      store.clock.set(new Date(instant(1, '09:10')));
      const response = await issueAsset(store, {
        assetId: 'HARN-002',
        workerId: 'WKR-001',
        keeperId: 'KPR-01',
        effectiveAt: instant(1, '09:00'),
      });
      expect(expectApiError(response, 409, 'asset_reserved_by_other').message).toContain(
        'Tomasz Nowak (WKR-002)',
      );
    });

    it('refuses a named reservation that belongs to a different asset or worker', async () => {
      const created = await reserveAsset(store, {
        assetId: 'LAD-003',
        workerId: 'WKR-008',
        keeperId: 'KPR-01',
        startsAt: instant(1, '08:00'),
        endsAt: instant(1, '12:00'),
      });
      const reservationId = (created.body as Reservation).reservationId;
      store.clock.set(new Date(instant(1, '08:10')));
      const response = await issueAsset(store, {
        assetId: 'LAD-003',
        workerId: 'WKR-006',
        keeperId: 'KPR-01',
        effectiveAt: instant(1, '08:05'),
        reservationId,
      });
      expectApiError(response, 422, 'reservation_mismatch');
    });

    it('lets the asset go out to anyone once the window has passed uncollected', async () => {
      const response = await issueAsset(store, {
        assetId: 'DRL-001',
        workerId: 'WKR-006',
        keeperId: 'KPR-01',
        effectiveAt: instant(0, '07:40'),
      });
      expect(response.status).toBe(201);
    });
  });

  it('agrees with the asset detail endpoint straight after the write', async () => {
    const issued = await issueAsset(store, {
      assetId: 'DRL-003',
      workerId: 'WKR-001',
      keeperId: 'KPR-01',
      effectiveAt: instant(0, '07:40'),
    });
    const detail = await assetNow(store, 'DRL-003');
    expect(detail.body as AssetSnapshot).toEqual((issued.body as MovementResult).asset);
  });
});
