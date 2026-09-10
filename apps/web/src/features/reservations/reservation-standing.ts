import type { ReservationStanding } from '@equipment-ledger/shared';

export const RESERVATION_STANDING_LABELS: Record<ReservationStanding, string> = {
  upcoming: 'upcoming',
  current: 'current',
  uncollected: 'uncollected',
};
