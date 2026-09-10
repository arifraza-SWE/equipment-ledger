import { issueAsset, reserveAsset } from '../support/ledger-requests';
import { readEffectiveMovements } from '../support/mongo-readers';
import { naiveStateAt, readAllMovements } from '../support/naive-replay';
import { instant, openTestStore, type TestStore } from '../support/test-store';

describe('invariant: an out-of-service asset cannot be newly issued or reserved', () => {
  let store: TestStore;

  beforeAll(async () => {
    store = await openTestStore();
  });

  afterAll(async () => {
    await store.close();
  });

  it('refuses every out-of-service asset at the hatch', async () => {
    const movements = await readAllMovements(store.connection);
    const withdrawn = [...naiveStateAt(movements, store.clock.now())]
      .filter(([, state]) => state.outOfService)
      .map(([assetId]) => assetId);
    expect(withdrawn.length).toBeGreaterThanOrEqual(2);

    for (const assetId of withdrawn) {
      const issue = await issueAsset(store, {
        assetId,
        workerId: 'WKR-003',
        keeperId: 'KPR-01',
        effectiveAt: instant(0, '08:00'),
      });
      const reservation = await reserveAsset(store, {
        assetId,
        workerId: 'WKR-003',
        keeperId: 'KPR-01',
        startsAt: instant(1, '08:00'),
        endsAt: instant(1, '12:00'),
      });
      expect({ assetId, issue: issue.status, reservation: reservation.status }).toEqual({
        assetId,
        issue: 422,
        reservation: 422,
      });
      expect(issue.body).toMatchObject({ code: 'asset_out_of_service' });
      expect(reservation.body).toMatchObject({ code: 'asset_out_of_service' });
    }
  });

  it('has no issue on the ledger inside an out-of-service interval', async () => {
    const movements = await readEffectiveMovements(store.connection);
    for (const issue of movements.filter((movement) => movement.type === 'issue')) {
      const stateJustBefore = naiveStateAt(
        movements,
        new Date(issue.effectiveAt.getTime() - 1),
      ).get(issue.assetId);
      expect({
        assetId: issue.assetId,
        at: issue.effectiveAt.toISOString(),
        outOfService: stateJustBefore?.outOfService ?? false,
      }).toMatchObject({ outOfService: false });
    }
  });
});
