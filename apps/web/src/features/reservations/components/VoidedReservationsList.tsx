import type { Reservation } from '@equipment-ledger/shared';
import { workerNameOr, type WorkerNamesById } from '@/features/workers/worker-names';
import { ReservationWindow } from './ReservationWindow';

interface VoidedReservationsListProps {
  reservations: Reservation[];
  workerNamesById: WorkerNamesById;
}

export function VoidedReservationsList({
  reservations,
  workerNamesById,
}: VoidedReservationsListProps) {
  if (reservations.length === 0) {
    return <span>No reservations were affected.</span>;
  }
  return (
    <ul>
      {reservations.map((reservation) => (
        <li key={reservation.reservationId}>
          <ReservationWindow reservation={reservation} /> for{' '}
          {workerNameOr(workerNamesById, reservation.workerId)}
          {reservation.closedReason && <span className="muted"> · {reservation.closedReason}</span>}
        </li>
      ))}
    </ul>
  );
}
