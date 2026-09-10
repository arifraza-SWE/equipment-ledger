import type { AssetSnapshot, MovementResult, StoreSnapshot } from '@equipment-ledger/shared';
import {
  assetNow,
  correctMovement,
  issueAsset,
  returnAsset,
  storeAsOf,
} from '../support/ledger-requests';
import { instant, openTestStore, SEED_ANCHOR, type TestStore } from '../support/test-store';

describe('the store as of an instant', () => {
  let store: TestStore;

  beforeAll(async () => {
    store = await openTestStore();
    await store.reseed();
  });

  afterAll(async () => {
    await store.close();
  });

  async function drillAt(at: string): Promise<AssetSnapshot> {
    const snapshot = (await storeAsOf(store, at)).body as StoreSnapshot;
    const drill = snapshot.assets.find((asset) => asset.asset.assetId === 'DRL-003');
    if (!drill) {
      throw new Error('DRL-003 missing from snapshot');
    }
    return drill;
  }

  describe('around one issue and one return', () => {
    const issuedAt = instant(0, '07:40');
    const returnedAt = instant(0, '11:20');

    beforeAll(async () => {
      await issueAsset(store, {
        assetId: 'DRL-003',
        workerId: 'WKR-001',
        keeperId: 'KPR-01',
        effectiveAt: issuedAt,
      });
      await returnAsset(store, {
        assetId: 'DRL-003',
        returnedByWorkerId: 'WKR-001',
        keeperId: 'KPR-01',
        effectiveAt: returnedAt,
      });
    });

    it('is in store one second before the issue', async () => {
      expect((await drillAt(instant(0, '07:39'))).status).toBe('in_store');
    });

    it('is held at exactly the issue instant', async () => {
      const drill = await drillAt(issuedAt);
      expect(drill.status).toBe('issued');
      expect(drill.holding?.worker.workerId).toBe('WKR-001');
    });

    it('is held after the issue', async () => {
      expect((await drillAt(instant(0, '09:00'))).holding?.worker.workerId).toBe('WKR-001');
    });

    it('is back in store at exactly the return instant', async () => {
      expect((await drillAt(returnedAt)).status).toBe('in_store');
    });

    it('is in store after the return', async () => {
      expect((await drillAt(instant(0, '11:50'))).status).toBe('in_store');
    });
  });

  it('answers who held what two days ago at 14:20', async () => {
    const snapshot = (await storeAsOf(store, instant(-2, '14:20'))).body as StoreSnapshot;
    const gasDetector = snapshot.assets.find((asset) => asset.asset.assetId === 'GAS-001');
    expect(gasDetector?.holding?.worker).toEqual({
      workerId: 'WKR-005',
      fullName: 'Daniel Okafor',
    });
    expect(snapshot.asOf).toBe(instant(-2, '14:20'));
  });

  it('reports an empty store before it existed, and says when it opened', async () => {
    const snapshot = (await storeAsOf(store, '2024-01-01T00:00:00Z')).body as StoreSnapshot;
    expect(snapshot.assets).toEqual([]);
    expect(snapshot.totals.assets).toBe(0);
    expect(snapshot.storeOpenedAt).toBe(instant(-45, '08:00'));
  });

  it('shows every asset in store on the morning the store opened', async () => {
    const snapshot = (await storeAsOf(store, instant(-45, '09:00'))).body as StoreSnapshot;
    expect(snapshot.totals).toEqual({
      assets: 60,
      inStore: 60,
      issued: 0,
      overdue: 0,
      reserved: 0,
      outOfService: 0,
    });
  });

  it('marks a holding overdue only once its due time has passed', async () => {
    const beforeDue = (await storeAsOf(store, instant(-4, '16:59'))).body as StoreSnapshot;
    const afterDue = (await storeAsOf(store, instant(-4, '17:01'))).body as StoreSnapshot;
    expect(beforeDue.assets.find((asset) => asset.asset.assetId === 'HARN-003')?.status).toBe(
      'issued',
    );
    expect(afterDue.assets.find((asset) => asset.asset.assetId === 'HARN-003')?.status).toBe(
      'overdue',
    );
  });

  it('shows the out-of-service asset as such only from its withdrawal instant', async () => {
    const before = (await storeAsOf(store, instant(-6, '10:14'))).body as StoreSnapshot;
    const after = (await storeAsOf(store, instant(-6, '10:15'))).body as StoreSnapshot;
    expect(before.assets.find((asset) => asset.asset.assetId === 'GAS-002')?.serviceStatus).toBe(
      'in_service',
    );
    expect(after.assets.find((asset) => asset.asset.assetId === 'GAS-002')?.serviceStatus).toBe(
      'out_of_service',
    );
  });

  it('uses the corrected interpretation of the seeded correction on GRN-002', async () => {
    const snapshot = (await storeAsOf(store, instant(-9, '16:00'))).body as StoreSnapshot;
    expect(snapshot.assets.find((asset) => asset.asset.assetId === 'GRN-002')?.status).toBe(
      'in_store',
    );
  });

  it('follows a fresh correction immediately', async () => {
    const returned = await returnAsset(store, {
      assetId: 'DRL-007',
      returnedByWorkerId: 'WKR-006',
      keeperId: 'KPR-02',
      effectiveAt: instant(0, '11:00'),
    });
    const movementId = (returned.body as MovementResult).movement.movementId;
    await correctMovement(store, movementId, {
      kind: 'amend',
      reason: 'It was nine',
      keeperId: 'KPR-01',
      effectiveAt: instant(0, '09:00'),
    });
    const snapshot = (await storeAsOf(store, instant(0, '10:00'))).body as StoreSnapshot;
    expect(snapshot.assets.find((asset) => asset.asset.assetId === 'DRL-007')?.status).toBe(
      'in_store',
    );
  });

  it('defaults to now and agrees with the per-asset endpoint for every asset', async () => {
    const snapshot = (await storeAsOf(store)).body as StoreSnapshot;
    expect(snapshot.asOf).toBe(store.clock.now().toISOString());
    for (const fromStore of snapshot.assets) {
      const fromDetail = (await assetNow(store, fromStore.asset.assetId)).body as AssetSnapshot;
      expect(fromDetail).toEqual(fromStore);
    }
  });

  it('rejects a malformed instant', async () => {
    const response = await storeAsOf(store, 'last tuesday');
    expect(response.status).toBe(400);
  });

  it('keeps the seed anchor where the tests expect it', () => {
    expect(SEED_ANCHOR.toISOString()).toBe('2026-09-10T00:00:00.000Z');
  });
});
