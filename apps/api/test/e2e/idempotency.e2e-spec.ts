import {
  IDEMPOTENCY_REPLAYED_HEADER,
  type MovementResult,
  type Reservation,
} from '@equipment-ledger/shared';
import { expectApiError } from '../support/expectations';
import { issueAsset, reserveAsset } from '../support/ledger-requests';
import { countIssuesAt, readReservations } from '../support/mongo-readers';
import { idempotencyKey, instant, openTestStore, type TestStore } from '../support/test-store';

describe('idempotent commands', () => {
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

  const issueRequest = {
    assetId: 'DRL-003',
    workerId: 'WKR-001',
    keeperId: 'KPR-01',
    effectiveAt: instant(0, '07:40'),
  };

  it('replays the same response for the same key and body, and writes one movement', async () => {
    const key = idempotencyKey();
    const first = await issueAsset(store, issueRequest, key);
    const second = await issueAsset(store, issueRequest, key);
    const third = await issueAsset(store, issueRequest, key);

    expect(first.status).toBe(201);
    expect(first.headers[IDEMPOTENCY_REPLAYED_HEADER]).toBeUndefined();
    for (const replay of [second, third]) {
      expect(replay.status).toBe(201);
      expect(replay.headers[IDEMPOTENCY_REPLAYED_HEADER]).toBe('true');
      expect(replay.body).toEqual(first.body);
    }
    expect(await countIssuesAt(store.connection, 'DRL-003', issueRequest.effectiveAt)).toBe(1);
  });

  it('keeps one movement when the same request arrives five times at once', async () => {
    const key = idempotencyKey();
    const responses = await Promise.all(
      Array.from({ length: 5 }, () => issueAsset(store, issueRequest, key)),
    );
    const statuses = responses.map((response) => response.status).sort();
    expect(statuses[0]).toBe(201);
    for (const status of statuses) {
      expect([201, 409]).toContain(status);
    }
    expect(await countIssuesAt(store.connection, 'DRL-003', issueRequest.effectiveAt)).toBe(1);
  });

  it('refuses a key that was already used for a different body', async () => {
    const key = idempotencyKey();
    await issueAsset(store, issueRequest, key);
    const response = await issueAsset(store, { ...issueRequest, workerId: 'WKR-002' }, key);
    expectApiError(response, 422, 'idempotency_key_reused');
  });

  it('replays a refusal as well, so a retried bad request gets the same answer', async () => {
    const key = idempotencyKey();
    const refused = { ...issueRequest, assetId: 'GAS-002', workerId: 'WKR-005' };
    const first = await issueAsset(store, refused, key);
    const second = await issueAsset(store, refused, key);
    expectApiError(first, 422, 'asset_out_of_service');
    expect(second.status).toBe(422);
    expect(second.headers[IDEMPOTENCY_REPLAYED_HEADER]).toBe('true');
    expect(second.body).toEqual(first.body);
  });

  it('does not confuse two different keys for the same body', async () => {
    const first = await issueAsset(store, issueRequest, idempotencyKey());
    const second = await issueAsset(store, issueRequest, idempotencyKey());
    expect(first.status).toBe(201);
    expectApiError(second, 409, 'asset_already_issued');
    expect(await countIssuesAt(store.connection, 'DRL-003', issueRequest.effectiveAt)).toBe(1);
  });

  it('requires a key on every command', async () => {
    const response = await store.http.post('/movements/issues').send(issueRequest);
    expectApiError(response, 400, 'idempotency_key_missing');
    expect(await countIssuesAt(store.connection, 'DRL-003', issueRequest.effectiveAt)).toBe(0);
  });

  it('rejects a key that is too short to be a real one', async () => {
    const response = await store.http
      .post('/movements/issues')
      .set('idempotency-key', 'abc')
      .send(issueRequest);
    expectApiError(response, 400, 'idempotency_key_missing');
  });

  it('applies to reservations too', async () => {
    const key = idempotencyKey();
    const request = {
      assetId: 'DRL-003',
      workerId: 'WKR-006',
      keeperId: 'KPR-01',
      startsAt: instant(1, '08:00'),
      endsAt: instant(1, '12:00'),
    };
    const first = await reserveAsset(store, request, key);
    const second = await reserveAsset(store, request, key);
    expect(first.status).toBe(201);
    expect((second.body as Reservation).reservationId).toBe(
      (first.body as Reservation).reservationId,
    );
    expect(await readReservations(store.connection, 'DRL-003')).toHaveLength(1);
  });

  it('gives the replay the same asset state it reported the first time', async () => {
    const key = idempotencyKey();
    const first = (await issueAsset(store, issueRequest, key)).body as MovementResult;
    const replay = (await issueAsset(store, issueRequest, key)).body as MovementResult;
    expect(replay.asset).toEqual(first.asset);
  });
});
