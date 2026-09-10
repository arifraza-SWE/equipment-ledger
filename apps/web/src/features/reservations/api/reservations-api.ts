import type {
  CreateReservationRequest,
  Reservation,
  ReservationStatus,
} from '@equipment-ledger/shared';
import { apiMutation, apiRequest, type MutationOutcome } from '@/lib/api-client';

export type ReservationFilters = {
  assetId?: string;
  workerId?: string;
  status?: ReservationStatus;
};

export function fetchReservations(filters: ReservationFilters = {}): Promise<Reservation[]> {
  return apiRequest<Reservation[]>('/reservations', { query: filters });
}

export function createReservation(
  request: CreateReservationRequest,
  idempotencyKey: string,
): Promise<MutationOutcome<Reservation>> {
  return apiMutation<Reservation>('/reservations', {
    method: 'POST',
    body: request,
    idempotencyKey,
  });
}

export function cancelReservation(
  reservationId: string,
  idempotencyKey: string,
): Promise<MutationOutcome<Reservation>> {
  return apiMutation<Reservation>(`/reservations/${encodeURIComponent(reservationId)}`, {
    method: 'DELETE',
    idempotencyKey,
  });
}
