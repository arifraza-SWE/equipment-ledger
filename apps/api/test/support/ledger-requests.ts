import type {
  ChangeServiceStatusRequest,
  CorrectMovementRequest,
  CreateReservationRequest,
  IssueAssetRequest,
  ReturnAssetRequest,
} from '@equipment-ledger/shared';
import type { Response } from 'supertest';
import { type TestStore, withKey } from './test-store';

export function issueAsset(
  store: TestStore,
  body: IssueAssetRequest,
  key?: string,
): Promise<Response> {
  return store.http.post('/movements/issues').set(withKey(key)).send(body);
}

export function returnAsset(
  store: TestStore,
  body: ReturnAssetRequest,
  key?: string,
): Promise<Response> {
  return store.http.post('/movements/returns').set(withKey(key)).send(body);
}

export function correctMovement(
  store: TestStore,
  movementId: string,
  body: CorrectMovementRequest,
  key?: string,
): Promise<Response> {
  return store.http.post(`/movements/${movementId}/corrections`).set(withKey(key)).send(body);
}

export function reserveAsset(
  store: TestStore,
  body: CreateReservationRequest,
  key?: string,
): Promise<Response> {
  return store.http.post('/reservations').set(withKey(key)).send(body);
}

export function cancelReservation(
  store: TestStore,
  reservationId: string,
  key?: string,
): Promise<Response> {
  return store.http.delete(`/reservations/${reservationId}`).set(withKey(key));
}

export function changeServiceStatus(
  store: TestStore,
  assetId: string,
  body: ChangeServiceStatusRequest,
  key?: string,
): Promise<Response> {
  return store.http.post(`/assets/${assetId}/service-status`).set(withKey(key)).send(body);
}

export function storeAsOf(store: TestStore, at?: string): Promise<Response> {
  return at ? store.http.get('/ledger/as-of').query({ at }) : store.http.get('/ledger/as-of');
}

export function assetHistory(store: TestStore, assetId: string): Promise<Response> {
  return store.http.get(`/assets/${assetId}/history`);
}

export function assetNow(store: TestStore, assetId: string): Promise<Response> {
  return store.http.get(`/assets/${assetId}`);
}
