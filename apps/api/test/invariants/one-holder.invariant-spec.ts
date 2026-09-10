import {
  findTimelineViolation,
  sortTimeline,
} from '../../src/modules/ledger/domain/asset-timeline';
import { toTimelineEntry } from '../../src/modules/ledger/persistence/movements.repository';
import { issueAsset, returnAsset } from '../support/ledger-requests';
import { readEffectiveMovements } from '../support/mongo-readers';
import { naiveStateAt, readAllMovements } from '../support/naive-replay';
import { instant, openTestStore, type TestStore } from '../support/test-store';

const STORM_TARGETS: Array<{ assetId: string; workerIds: string[] }> = [
  { assetId: 'HARN-014', workerIds: ['WKR-001', 'WKR-002', 'WKR-003', 'WKR-005', 'WKR-012'] },
  { assetId: 'DRL-003', workerIds: ['WKR-006', 'WKR-008', 'WKR-011'] },
  { assetId: 'GAS-004', workerIds: ['WKR-003', 'WKR-005'] },
  { assetId: 'LAD-004', workerIds: ['WKR-006', 'WKR-008', 'WKR-011', 'WKR-002'] },
  { assetId: 'RAD-002', workerIds: ['WKR-009', 'WKR-010'] },
  { assetId: 'TWR-003', workerIds: ['WKR-001', 'WKR-003', 'WKR-012'] },
];

describe('invariant: an asset has at most one holder at any instant', () => {
  let store: TestStore;

  beforeAll(async () => {
    store = await openTestStore();
  });

  afterAll(async () => {
    await store.close();
  });

  it('survives a storm of simultaneous issues across several assets', async () => {
    const attempts = STORM_TARGETS.flatMap(({ assetId, workerIds }) =>
      Array.from({ length: 8 }, (_, index) => ({
        assetId,
        workerId: workerIds[index % workerIds.length]!,
      })),
    );
    const responses = await Promise.all(
      attempts.map((attempt) =>
        issueAsset(store, { ...attempt, keeperId: 'KPR-01', effectiveAt: instant(0, '07:45') }),
      ),
    );

    for (const { assetId } of STORM_TARGETS) {
      const outcomes = responses.filter((_, index) => attempts[index]!.assetId === assetId);
      expect(outcomes.filter((response) => response.status === 201)).toHaveLength(1);
      expect(outcomes.filter((response) => response.status === 409)).toHaveLength(7);
    }
  });

  it('survives issues and returns racing on the same asset', async () => {
    const responses = await Promise.all([
      returnAsset(store, {
        assetId: 'HARN-014',
        returnedByWorkerId: 'WKR-001',
        keeperId: 'KPR-01',
        effectiveAt: instant(0, '09:00'),
        acknowledgeDifferentReturner: true,
      }),
      issueAsset(store, {
        assetId: 'HARN-014',
        workerId: 'WKR-002',
        keeperId: 'KPR-01',
        effectiveAt: instant(0, '09:05'),
      }),
      returnAsset(store, {
        assetId: 'HARN-014',
        returnedByWorkerId: 'WKR-002',
        keeperId: 'KPR-01',
        effectiveAt: instant(0, '09:10'),
        acknowledgeDifferentReturner: true,
      }),
      issueAsset(store, {
        assetId: 'HARN-014',
        workerId: 'WKR-003',
        keeperId: 'KPR-01',
        effectiveAt: instant(0, '09:15'),
      }),
    ]);
    expect(responses.every((response) => [201, 409, 422].includes(response.status))).toBe(true);
  });

  it('leaves every asset with a ledger that alternates issue and return', async () => {
    const movements = await readEffectiveMovements(store.connection);
    const assetIds = [...new Set(movements.map((movement) => movement.assetId))];
    for (const assetId of assetIds) {
      const timeline = sortTimeline(
        movements.filter((movement) => movement.assetId === assetId).map(toTimelineEntry),
      );
      expect({ assetId, violation: findTimelineViolation(timeline) }).toEqual({
        assetId,
        violation: null,
      });
    }
  });

  it('never shows two holders for one asset at any of ten thousand sampled instants', async () => {
    const movements = await readAllMovements(store.connection);
    const start = new Date(instant(-31, '00:00')).getTime();
    const end = new Date(instant(1, '00:00')).getTime();
    const step = Math.floor((end - start) / 10_000);
    for (let sampled = start; sampled <= end; sampled += step) {
      const holders = new Map<string, Set<string>>();
      for (const movement of movements) {
        if (
          movement.supersededByCorrectionId !== null ||
          movement.effectiveAt.getTime() > sampled
        ) {
          continue;
        }
        const state = naiveStateAt(movements, new Date(sampled)).get(movement.assetId);
        if (state?.holderWorkerId) {
          holders.set(movement.assetId, new Set([state.holderWorkerId]));
        }
      }
      for (const [assetId, workerIds] of holders) {
        expect({ assetId, holders: workerIds.size }).toEqual({ assetId, holders: 1 });
      }
    }
  });
});
