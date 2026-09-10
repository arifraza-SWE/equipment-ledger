import type { AssetRecord } from '../../src/modules/assets/asset.schema';
import type { CorrectionRecord } from '../../src/modules/ledger/persistence/correction.schema';
import { correctMovement, issueAsset, returnAsset } from '../support/ledger-requests';
import { readMovements, readReservations } from '../support/mongo-readers';
import { instant, openTestStore, type TestStore } from '../support/test-store';

describe('invariant: the ledger documents reference each other consistently', () => {
  let store: TestStore;

  beforeAll(async () => {
    store = await openTestStore();
    const returned = await returnAsset(store, {
      assetId: 'DRL-007',
      returnedByWorkerId: 'WKR-006',
      keeperId: 'KPR-02',
      effectiveAt: instant(0, '10:00'),
    });
    const returnMovementId = (returned.body as { movement: { movementId: string } }).movement
      .movementId;
    await correctMovement(store, returnMovementId, {
      kind: 'amend',
      reason: 'Earlier than written',
      keeperId: 'KPR-01',
      effectiveAt: instant(0, '09:00'),
    });
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

  it('pairs every superseded movement with exactly one correction, and every correction with its movements', async () => {
    const movements = await readMovements(store.connection);
    const corrections = await store.connection
      .collection<CorrectionRecord>('corrections')
      .find({})
      .toArray();
    const byId = new Map(movements.map((movement) => [movement._id.toHexString(), movement]));

    for (const movement of movements.filter(
      (candidate) => candidate.supersededByCorrectionId !== null,
    )) {
      const matching = corrections.filter((correction) =>
        correction.originalMovementId.equals(movement._id),
      );
      expect({
        movementId: movement._id.toHexString(),
        corrections: matching.length,
      }).toMatchObject({ corrections: 1 });
      expect(matching[0]!._id.equals(movement.supersededByCorrectionId)).toBe(true);
    }

    for (const correction of corrections) {
      const original = byId.get(correction.originalMovementId.toHexString());
      expect(original?.supersededByCorrectionId?.equals(correction._id)).toBe(true);
      if (correction.kind === 'amend') {
        const replacement = byId.get(correction.replacementMovementId!.toHexString());
        expect(replacement?.createdByCorrectionId?.equals(correction._id)).toBe(true);
        expect(replacement?.assetId).toBe(original?.assetId);
        expect(replacement?.sequence).toBe(original?.sequence);
      } else {
        expect(correction.replacementMovementId).toBeNull();
      }
    }
  });

  it('never has two effective movements sharing a sequence on one asset', async () => {
    const movements = (await readMovements(store.connection)).filter(
      (movement) => movement.supersededByCorrectionId === null,
    );
    const seen = new Set<string>();
    for (const movement of movements) {
      const key = `${movement.assetId}#${movement.sequence}`;
      expect({ key, duplicate: seen.has(key) }).toMatchObject({ duplicate: false });
      seen.add(key);
    }
  });

  it('keeps every asset version at or beyond its highest sequence, so the next write cannot collide', async () => {
    const assets = await store.connection.collection<AssetRecord>('assets').find({}).toArray();
    const movements = await readMovements(store.connection);
    for (const asset of assets) {
      const highest = Math.max(
        0,
        ...movements
          .filter((movement) => movement.assetId === asset._id)
          .map((movement) => movement.sequence),
      );
      expect({
        assetId: asset._id,
        version: asset.version,
        highest,
        ok: asset.version >= highest,
      }).toMatchObject({ ok: true });
    }
  });

  it('dates nothing before the asset was registered and never records before it happened', async () => {
    const assets = new Map(
      (await store.connection.collection<AssetRecord>('assets').find({}).toArray()).map((asset) => [
        asset._id,
        asset,
      ]),
    );
    for (const movement of await readMovements(store.connection)) {
      const asset = assets.get(movement.assetId)!;
      expect(movement.effectiveAt.getTime()).toBeGreaterThanOrEqual(asset.registeredAt.getTime());
      expect(movement.recordedAt.getTime()).toBeGreaterThanOrEqual(movement.effectiveAt.getTime());
    }
  });

  it('links every fulfilled reservation to an issue of the same asset to the same worker', async () => {
    const movements = await readMovements(store.connection);
    for (const reservation of (await readReservations(store.connection)).filter(
      (candidate) => candidate.status === 'fulfilled',
    )) {
      const issue = movements.find((movement) =>
        movement._id.equals(reservation.fulfilledByMovementId),
      );
      expect(issue).toMatchObject({
        type: 'issue',
        assetId: reservation.assetId,
        workerId: reservation.workerId,
      });
    }
  });
});
