import type { Reservation } from '@equipment-ledger/shared';
import { expectApiError } from '../support/expectations';
import { cancelReservation, reserveAsset } from '../support/ledger-requests';
import { readReservations } from '../support/mongo-readers';
import { instant, openTestStore, type TestStore } from '../support/test-store';

describe('reservations', () => {
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

  const tomorrowMorning = { startsAt: instant(1, '08:00'), endsAt: instant(1, '12:00') };

  it('creates an active, upcoming reservation', async () => {
    const response = await reserveAsset(store, {
      assetId: 'DRL-003',
      workerId: 'WKR-006',
      keeperId: 'KPR-01',
      ...tomorrowMorning,
    });
    expect(response.status).toBe(201);
    expect(response.body as Reservation).toMatchObject({
      assetId: 'DRL-003',
      status: 'active',
      standing: 'upcoming',
    });
  });

  it('refuses a window that overlaps another reservation and leaves the existing one untouched', async () => {
    const before = await readReservations(store.connection, 'TWR-001');
    const response = await reserveAsset(store, {
      assetId: 'TWR-001',
      workerId: 'WKR-012',
      keeperId: 'KPR-01',
      startsAt: instant(2, '10:00'),
      endsAt: instant(2, '14:00'),
    });
    const error = expectApiError(response, 409, 'reservation_overlap');
    expect(error.message).toContain('Priya Raman (WKR-003)');
    expect(await readReservations(store.connection, 'TWR-001')).toEqual(before);
  });

  it('refuses a window that wholly contains an existing one', async () => {
    const response = await reserveAsset(store, {
      assetId: 'TWR-001',
      workerId: 'WKR-012',
      keeperId: 'KPR-01',
      startsAt: instant(2, '07:00'),
      endsAt: instant(2, '13:00'),
    });
    expectApiError(response, 409, 'reservation_overlap');
  });

  it('allows an adjacent window that starts exactly when the other ends', async () => {
    const response = await reserveAsset(store, {
      assetId: 'TWR-001',
      workerId: 'WKR-012',
      keeperId: 'KPR-01',
      startsAt: instant(2, '12:00'),
      endsAt: instant(2, '14:00'),
    });
    expect(response.status).toBe(201);
  });

  it('allows an adjacent window that ends exactly when the other starts', async () => {
    const response = await reserveAsset(store, {
      assetId: 'TWR-001',
      workerId: 'WKR-012',
      keeperId: 'KPR-01',
      startsAt: instant(2, '06:00'),
      endsAt: instant(2, '08:00'),
    });
    expect(response.status).toBe(201);
  });

  it('refuses a window that ends before it starts', async () => {
    const response = await reserveAsset(store, {
      assetId: 'DRL-003',
      workerId: 'WKR-006',
      keeperId: 'KPR-01',
      startsAt: instant(1, '12:00'),
      endsAt: instant(1, '08:00'),
    });
    expectApiError(response, 422, 'reservation_window_invalid');
  });

  it('refuses a window in the past', async () => {
    const response = await reserveAsset(store, {
      assetId: 'DRL-003',
      workerId: 'WKR-006',
      keeperId: 'KPR-01',
      startsAt: instant(-1, '08:00'),
      endsAt: instant(-1, '12:00'),
    });
    expect(expectApiError(response, 422, 'reservation_window_invalid').message).toContain(
      'claim on the future',
    );
  });

  it('refuses a whole year', async () => {
    const response = await reserveAsset(store, {
      assetId: 'DRL-003',
      workerId: 'WKR-006',
      keeperId: 'KPR-01',
      startsAt: instant(1, '08:00'),
      endsAt: instant(366, '08:00'),
    });
    expect(expectApiError(response, 422, 'reservation_window_invalid').message).toContain(
      '14 days',
    );
  });

  it('refuses an out-of-service asset', async () => {
    const response = await reserveAsset(store, {
      assetId: 'GAS-002',
      workerId: 'WKR-005',
      keeperId: 'KPR-01',
      ...tomorrowMorning,
    });
    expectApiError(response, 422, 'asset_out_of_service');
  });

  it('refuses a worker whose certificate will not be valid at the start of the window', async () => {
    const response = await reserveAsset(store, {
      assetId: 'GAS-004',
      workerId: 'WKR-007',
      keeperId: 'KPR-01',
      ...tomorrowMorning,
    });
    expectApiError(response, 422, 'certification_expired');
  });

  it('does not treat cancelled or voided reservations as claims on the window', async () => {
    const created = await reserveAsset(store, {
      assetId: 'DRL-003',
      workerId: 'WKR-006',
      keeperId: 'KPR-01',
      ...tomorrowMorning,
    });
    const reservationId = (created.body as Reservation).reservationId;
    const cancelled = await cancelReservation(store, reservationId);
    expect(cancelled.status).toBe(200);
    expect(cancelled.body as Reservation).toMatchObject({ status: 'cancelled', standing: null });

    const again = await reserveAsset(store, {
      assetId: 'DRL-003',
      workerId: 'WKR-008',
      keeperId: 'KPR-01',
      ...tomorrowMorning,
    });
    expect(again.status).toBe(201);
  });

  it('refuses to cancel a reservation twice', async () => {
    const created = await reserveAsset(store, {
      assetId: 'DRL-003',
      workerId: 'WKR-006',
      keeperId: 'KPR-01',
      ...tomorrowMorning,
    });
    const reservationId = (created.body as Reservation).reservationId;
    await cancelReservation(store, reservationId);
    const response = await cancelReservation(store, reservationId);
    expectApiError(response, 409, 'reservation_not_active');
  });

  it('reports a reservation nobody collected as uncollected', async () => {
    const response = await store.http.get('/reservations').query({ assetId: 'DRL-001' });
    expect(response.status).toBe(200);
    expect(response.body as Reservation[]).toEqual([
      expect.objectContaining({ workerId: 'WKR-009', status: 'active', standing: 'uncollected' }),
    ]);
  });
});
