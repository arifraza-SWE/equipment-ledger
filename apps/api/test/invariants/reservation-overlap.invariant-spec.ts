import { windowsOverlap } from '../../src/modules/reservations/domain/reservation-window';
import { reserveAsset } from '../support/ledger-requests';
import { readReservations } from '../support/mongo-readers';
import { instant, openTestStore, type TestStore } from '../support/test-store';

describe('invariant: reservations on one asset never overlap', () => {
  let store: TestStore;

  beforeAll(async () => {
    store = await openTestStore();
  });

  afterAll(async () => {
    await store.close();
  });

  it('holds for the seeded store', async () => {
    expectNoOverlaps(await readReservations(store.connection));
  });

  it('holds after a storm of overlapping and adjacent requests', async () => {
    const assetIds = ['DRL-002', 'LAD-005', 'LVL-004', 'RAD-003', 'HARN-006'];
    const workerIds = ['WKR-001', 'WKR-002', 'WKR-003', 'WKR-005', 'WKR-012'];
    const attempts = assetIds.flatMap((assetId) =>
      Array.from({ length: 12 }, (_, index) => ({
        assetId,
        workerId: workerIds[index % workerIds.length]!,
        keeperId: 'KPR-01',
        startsAt: instant(
          1,
          `${String(8 + Math.floor(index / 3)).padStart(2, '0')}:${String((index % 3) * 20).padStart(2, '0')}`,
        ),
        endsAt: instant(
          1,
          `${String(9 + Math.floor(index / 3)).padStart(2, '0')}:${String((index % 3) * 20).padStart(2, '0')}`,
        ),
      })),
    );
    const responses = await Promise.all(attempts.map((attempt) => reserveAsset(store, attempt)));
    expect(responses.every((response) => [201, 409].includes(response.status))).toBe(true);
    expect(responses.some((response) => response.status === 201)).toBe(true);
    expectNoOverlaps(await readReservations(store.connection));
  });

  it('still lets adjacent windows through', async () => {
    const first = await reserveAsset(store, {
      assetId: 'LAD-006',
      workerId: 'WKR-008',
      keeperId: 'KPR-01',
      startsAt: instant(2, '08:00'),
      endsAt: instant(2, '10:00'),
    });
    const second = await reserveAsset(store, {
      assetId: 'LAD-006',
      workerId: 'WKR-006',
      keeperId: 'KPR-01',
      startsAt: instant(2, '10:00'),
      endsAt: instant(2, '12:00'),
    });
    expect([first.status, second.status]).toEqual([201, 201]);
    expectNoOverlaps(await readReservations(store.connection, 'LAD-006'));
  });
});

function expectNoOverlaps(reservations: Awaited<ReturnType<typeof readReservations>>): void {
  const claiming = reservations.filter(
    (reservation) => reservation.status === 'active' || reservation.status === 'fulfilled',
  );
  for (const left of claiming) {
    for (const right of claiming) {
      if (left._id.equals(right._id) || left.assetId !== right.assetId) {
        continue;
      }
      expect({
        assetId: left.assetId,
        left: left._id.toHexString(),
        right: right._id.toHexString(),
        overlap: windowsOverlap(left, right),
      }).toMatchObject({ overlap: false });
    }
  }
}
