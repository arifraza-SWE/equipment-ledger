import type { ReservationStatus } from '@equipment-ledger/shared';
import { StatusBadge, type BadgeTone } from './StatusBadge';

const RESERVATION_TONE: Record<ReservationStatus, BadgeTone> = {
  active: 'reserved',
  fulfilled: 'in_store',
  cancelled: 'neutral',
  voided: 'out_of_service',
};

export const RESERVATION_STATUS_LABELS: Record<ReservationStatus, string> = {
  active: 'Active',
  fulfilled: 'Fulfilled',
  cancelled: 'Cancelled',
  voided: 'Voided',
};

export function ReservationStatusBadge({ status }: { status: ReservationStatus }) {
  return (
    <StatusBadge tone={RESERVATION_TONE[status]}>{RESERVATION_STATUS_LABELS[status]}</StatusBadge>
  );
}
