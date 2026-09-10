import type { Reservation } from '@equipment-ledger/shared';
import { Instant } from '@/components/Instant';

export function ReservationWindow({ reservation }: { reservation: Reservation }) {
  return (
    <span>
      <Instant iso={reservation.startsAt} /> <span className="muted">to</span>{' '}
      <Instant iso={reservation.endsAt} />
    </span>
  );
}
