import type { AssetSnapshot, CertificationType } from '@equipment-ledger/shared';
import type { AssetRecord } from '../../src/modules/assets/asset.schema';
import type { WorkerRecord } from '../../src/modules/workers/worker.schema';
import { issueAsset } from '../support/ledger-requests';
import { readEffectiveMovements } from '../support/mongo-readers';
import { instant, openTestStore, type TestStore } from '../support/test-store';

function heldValidCertificate(
  worker: WorkerRecord,
  required: CertificationType,
  at: Date,
): boolean {
  return worker.certifications.some(
    (certification) =>
      certification.type === required &&
      certification.issuedAt <= at &&
      at < certification.expiresAt,
  );
}

describe('invariant: an expired or missing certificate cannot authorise an issue', () => {
  let store: TestStore;
  let assets: AssetRecord[];
  let workers: WorkerRecord[];

  beforeAll(async () => {
    store = await openTestStore();
    assets = await store.connection.collection<AssetRecord>('assets').find({}).toArray();
    workers = await store.connection.collection<WorkerRecord>('workers').find({}).toArray();
  });

  afterAll(async () => {
    await store.close();
  });

  it('holds for every issue the seed wrote', async () => {
    const issues = (await readEffectiveMovements(store.connection)).filter(
      (movement) => movement.type === 'issue',
    );
    for (const issue of issues) {
      const asset = assets.find((candidate) => candidate._id === issue.assetId)!;
      if (!asset.requiredCertification) {
        continue;
      }
      const worker = workers.find((candidate) => candidate._id === issue.workerId)!;
      expect({
        assetId: asset._id,
        workerId: worker._id,
        qualified: heldValidCertificate(worker, asset.requiredCertification, issue.effectiveAt),
      }).toMatchObject({ qualified: true });
    }
  });

  it('holds for every pairing of an issuable certificate-gated asset and a worker, tried at the hatch', async () => {
    const issuable = new Set(
      ((await store.http.get('/assets')).body as AssetSnapshot[])
        .filter((snapshot) => snapshot.status === 'in_store')
        .map((snapshot) => snapshot.asset.assetId),
    );
    const gated = assets
      .filter((asset) => asset.requiredCertification !== null && issuable.has(asset._id))
      .slice(0, 10);
    expect(gated.length).toBeGreaterThanOrEqual(5);
    const effectiveAt = new Date(instant(0, '08:00'));
    for (const asset of gated) {
      for (const worker of workers) {
        await store.reseed();
        const response = await issueAsset(store, {
          assetId: asset._id,
          workerId: worker._id,
          keeperId: 'KPR-01',
          effectiveAt: effectiveAt.toISOString(),
        });
        const qualified = heldValidCertificate(worker, asset.requiredCertification!, effectiveAt);
        const refusedForCertificate =
          response.status === 422 &&
          ['certification_expired', 'certification_missing'].includes(
            (response.body as { code: string }).code,
          );
        if (!qualified) {
          expect({
            assetId: asset._id,
            workerId: worker._id,
            status: response.status,
            refusedForCertificate,
          }).toMatchObject({ refusedForCertificate: true });
        } else {
          expect({ assetId: asset._id, workerId: worker._id, refusedForCertificate }).toMatchObject(
            { refusedForCertificate: false },
          );
        }
      }
    }
  });
});
