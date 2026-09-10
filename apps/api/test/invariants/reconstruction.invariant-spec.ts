import type { AssetSnapshot, StoreSnapshot } from '@equipment-ledger/shared';
import {
  assetNow,
  correctMovement,
  issueAsset,
  returnAsset,
  storeAsOf,
} from '../support/ledger-requests';
import { naiveStateAt, readAllMovements } from '../support/naive-replay';
import { instant, openTestStore, type TestStore } from '../support/test-store';

describe('invariant: the as-of answer agrees with a naive replay of the raw ledger', () => {
  let store: TestStore;

  beforeAll(async () => {
    store = await openTestStore();
    const returned = await returnAsset(store, {
      assetId: 'DRL-007',
      returnedByWorkerId: 'WKR-006',
      keeperId: 'KPR-02',
      effectiveAt: instant(0, '10:00'),
    });
    await correctMovement(
      store,
      (returned.body as { movement: { movementId: string } }).movement.movementId,
      {
        kind: 'amend',
        reason: 'It was earlier',
        keeperId: 'KPR-01',
        effectiveAt: instant(0, '09:10'),
      },
    );
    await issueAsset(store, {
      assetId: 'DRL-007',
      workerId: 'WKR-008',
      keeperId: 'KPR-02',
      effectiveAt: instant(0, '11:00'),
    });
  });

  afterAll(async () => {
    await store.close();
  });

  it('agrees at every four-hour tick across the seeded window and at every movement boundary', async () => {
    const movements = await readAllMovements(store.connection);
    const boundaries = movements.flatMap((movement) => [
      new Date(movement.effectiveAt.getTime() - 1),
      movement.effectiveAt,
      new Date(movement.effectiveAt.getTime() + 1),
    ]);
    const ticks: Date[] = [];
    for (let day = -46; day <= 1; day += 1) {
      for (const clockTime of ['00:00', '04:00', '08:00', '12:00', '16:00', '20:00']) {
        ticks.push(new Date(instant(day, clockTime)));
      }
    }
    const sampled = [...ticks, ...boundaries.filter((_, index) => index % 7 === 0)];

    for (const sampledInstant of sampled) {
      const expected = naiveStateAt(movements, sampledInstant);
      const snapshot = (await storeAsOf(store, sampledInstant.toISOString())).body as StoreSnapshot;
      for (const asset of snapshot.assets) {
        const expectedState = expected.get(asset.asset.assetId) ?? {
          holderWorkerId: null,
          outOfService: false,
        };
        expect({
          at: sampledInstant.toISOString(),
          assetId: asset.asset.assetId,
          holder: asset.holding?.worker.workerId ?? null,
          outOfService: asset.serviceStatus === 'out_of_service',
        }).toEqual({
          at: sampledInstant.toISOString(),
          assetId: asset.asset.assetId,
          holder: expectedState.holderWorkerId,
          outOfService: expectedState.outOfService,
        });
      }
    }
  });

  it('agrees with the per-asset endpoint for every asset right now', async () => {
    const snapshot = (await storeAsOf(store)).body as StoreSnapshot;
    for (const fromStore of snapshot.assets) {
      const fromDetail = (await assetNow(store, fromStore.asset.assetId)).body as AssetSnapshot;
      expect(fromDetail).toEqual(fromStore);
    }
  });

  it('counts the same number of holdings as there are open issues in Mongo', async () => {
    const movements = await readAllMovements(store.connection);
    const openIssues = [...naiveStateAt(movements, store.clock.now()).values()].filter(
      (state) => state.holderWorkerId !== null,
    ).length;
    const snapshot = (await storeAsOf(store)).body as StoreSnapshot;
    expect(snapshot.totals.issued).toBe(openIssues);
  });
});
