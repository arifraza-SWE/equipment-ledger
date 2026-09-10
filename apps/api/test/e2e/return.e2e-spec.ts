import type { MovementResult } from '@equipment-ledger/shared';
import { expectApiError } from '../support/expectations';
import { issueAsset, reserveAsset, returnAsset } from '../support/ledger-requests';
import { readEffectiveMovements } from '../support/mongo-readers';
import { instant, openTestStore, TEST_NOW, type TestStore } from '../support/test-store';

describe('returning an asset', () => {
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

  it('closes the holding and records who handed it back', async () => {
    const response = await returnAsset(store, {
      assetId: 'DRL-007',
      returnedByWorkerId: 'WKR-006',
      keeperId: 'KPR-02',
      effectiveAt: instant(0, '11:30'),
    });
    expect(response.status).toBe(201);
    const result = response.body as MovementResult;
    expect(result.movement).toMatchObject({
      type: 'return',
      workerId: 'WKR-006',
      returnedByWorkerId: 'WKR-006',
      effectiveAt: instant(0, '11:30'),
      recordedAt: TEST_NOW.toISOString(),
    });
    expect(result.asset.status).toBe('in_store');
    expect(result.asset.holding).toBeNull();
  });

  it("keeps a backdated return's two timestamps apart: 09:00 happened, 12:00 written down", async () => {
    const response = await returnAsset(store, {
      assetId: 'DRL-007',
      returnedByWorkerId: 'WKR-006',
      keeperId: 'KPR-02',
      effectiveAt: instant(0, '09:00'),
    });
    expect(response.status).toBe(201);
    const { movement } = response.body as MovementResult;
    expect(movement.effectiveAt).toBe(instant(0, '09:00'));
    expect(movement.recordedAt).toBe(instant(0, '12:00'));
    expect(new Date(movement.recordedAt).getTime() - new Date(movement.effectiveAt).getTime()).toBe(
      3 * 60 * 60 * 1000,
    );
  });

  it('refuses to return an asset that is not out', async () => {
    const response = await returnAsset(store, {
      assetId: 'RAD-001',
      returnedByWorkerId: 'WKR-006',
      keeperId: 'KPR-02',
      effectiveAt: instant(0, '11:30'),
    });
    expectApiError(response, 409, 'asset_not_issued');
  });

  it('refuses a second return and says when it came back', async () => {
    await returnAsset(store, {
      assetId: 'DRL-007',
      returnedByWorkerId: 'WKR-006',
      keeperId: 'KPR-02',
      effectiveAt: instant(0, '09:00'),
    });
    const response = await returnAsset(store, {
      assetId: 'DRL-007',
      returnedByWorkerId: 'WKR-006',
      keeperId: 'KPR-02',
      effectiveAt: instant(0, '11:00'),
    });
    expect(expectApiError(response, 409, 'asset_not_issued').message).toContain(
      'came back at 09:00',
    );
    expect(
      (await readEffectiveMovements(store.connection, 'DRL-007')).filter(
        (movement) => movement.type === 'return',
      ),
    ).toHaveLength(1);
  });

  it('refuses a return from a worker who is not the holder unless the keeper confirms it', async () => {
    const refused = await returnAsset(store, {
      assetId: 'HARN-003',
      returnedByWorkerId: 'WKR-001',
      keeperId: 'KPR-02',
      effectiveAt: instant(0, '11:30'),
    });
    const error = expectApiError(refused, 422, 'returner_mismatch');
    expect(error.message).toContain('held by Callum Reid (WKR-004)');

    const confirmed = await returnAsset(store, {
      assetId: 'HARN-003',
      returnedByWorkerId: 'WKR-001',
      keeperId: 'KPR-02',
      effectiveAt: instant(0, '11:30'),
      acknowledgeDifferentReturner: true,
    });
    expect(confirmed.status).toBe(201);
    expect((confirmed.body as MovementResult).movement).toMatchObject({
      workerId: 'WKR-004',
      returnedByWorkerId: 'WKR-001',
    });
  });

  it('refuses a return dated before the issue it would close', async () => {
    const response = await returnAsset(store, {
      assetId: 'DRL-007',
      returnedByWorkerId: 'WKR-006',
      keeperId: 'KPR-02',
      effectiveAt: instant(-1, '07:00'),
    });
    expectApiError(response, 422, 'timeline_conflict');
  });

  it('refuses a return at the exact instant of the issue', async () => {
    const issuedAt = instant(0, '07:40');
    await issueAsset(store, {
      assetId: 'DRL-003',
      workerId: 'WKR-001',
      keeperId: 'KPR-01',
      effectiveAt: issuedAt,
    });
    const response = await returnAsset(store, {
      assetId: 'DRL-003',
      returnedByWorkerId: 'WKR-001',
      keeperId: 'KPR-01',
      effectiveAt: issuedAt,
    });
    expect(expectApiError(response, 422, 'timeline_conflict').message).toContain(
      'at or before the issue',
    );
  });

  it('refuses a movement backdated into the middle of a later one', async () => {
    const response = await returnAsset(store, {
      assetId: 'LAD-002',
      returnedByWorkerId: 'WKR-008',
      keeperId: 'KPR-02',
      effectiveAt: instant(-5, '08:30'),
    });
    const error = expectApiError(response, 422, 'timeline_conflict');
    expect(error.message).toContain('later entry');
    expect(error.message).toContain('correct it instead');
  });

  it('can take a damaged asset out of service on return and voids its standing reservations', async () => {
    const reserved = await reserveAsset(store, {
      assetId: 'DRL-007',
      workerId: 'WKR-008',
      keeperId: 'KPR-01',
      startsAt: instant(2, '08:00'),
      endsAt: instant(2, '12:00'),
    });
    expect(reserved.status).toBe(201);

    const response = await returnAsset(store, {
      assetId: 'DRL-007',
      returnedByWorkerId: 'WKR-006',
      keeperId: 'KPR-02',
      effectiveAt: instant(0, '11:30'),
      takeOutOfService: true,
      note: 'Chuck jammed, will not release bits',
    });
    expect(response.status).toBe(201);
    const result = response.body as MovementResult;
    expect(result.asset.status).toBe('out_of_service');
    expect(result.serviceStatusChange).toMatchObject({
      type: 'out_of_service',
      effectiveAt: instant(0, '11:30'),
      note: 'Chuck jammed, will not release bits',
    });
    expect(result.voidedReservations).toHaveLength(1);
    expect(result.voidedReservations[0]).toMatchObject({
      status: 'voided',
      closedReason: 'Asset taken out of service',
    });

    const timeline = await readEffectiveMovements(store.connection, 'DRL-007');
    expect(timeline.slice(-2).map((movement) => movement.type)).toEqual([
      'return',
      'out_of_service',
    ]);
  });
});
