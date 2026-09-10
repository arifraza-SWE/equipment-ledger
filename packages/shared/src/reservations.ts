export const RESERVATION_STATUSES = ['active', 'fulfilled', 'cancelled', 'voided'] as const;

export type ReservationStatus = (typeof RESERVATION_STATUSES)[number];

export const RESERVATION_STANDINGS = ['upcoming', 'current', 'uncollected'] as const;

export type ReservationStanding = (typeof RESERVATION_STANDINGS)[number];

export interface Reservation {
  reservationId: string;
  assetId: string;
  workerId: string;
  keeperId: string;
  startsAt: string;
  endsAt: string;
  status: ReservationStatus;
  standing: ReservationStanding | null;
  note: string | null;
  createdAt: string;
  fulfilledByMovementId: string | null;
  closedAt: string | null;
  closedReason: string | null;
}

export interface CreateReservationRequest {
  assetId: string;
  workerId: string;
  keeperId: string;
  startsAt: string;
  endsAt: string;
  note?: string | null;
}

export const RESERVATION_RULES = {
  minDurationMinutes: 15,
  maxDurationDays: 14,
  maxLeadTimeDays: 90,
  pastToleranceMinutes: 2,
} as const;
