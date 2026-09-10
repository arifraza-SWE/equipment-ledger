import type { Reservation } from '@equipment-ledger/shared';
import Link from 'next/link';
import { DataTable } from '@/components/DataTable';
import { EmptyState } from '@/components/EmptyState';
import { Instant } from '@/components/Instant';
import { ReservationStatusBadge } from '@/components/ReservationStatusBadge';
import { workerNameOr, type WorkerNamesById } from '@/features/workers/worker-names';
import { RESERVATION_STANDING_LABELS } from '../reservation-standing';
import { CancelReservationButton } from './CancelReservationButton';
import styles from './ReservationsTable.module.css';

interface ReservationsTableProps {
  reservations: Reservation[];
  workerNamesById: WorkerNamesById;
  showAsset?: boolean;
  emptyTitle?: string;
}

export function ReservationsTable({
  reservations,
  workerNamesById,
  showAsset = true,
  emptyTitle = 'No reservations',
}: ReservationsTableProps) {
  if (reservations.length === 0) {
    return <EmptyState title={emptyTitle} />;
  }

  return (
    <DataTable caption="Reservations">
      <thead>
        <tr>
          {showAsset && <th scope="col">Asset</th>}
          <th scope="col">Worker</th>
          <th scope="col">Starts</th>
          <th scope="col">Ends</th>
          <th scope="col">Status</th>
          <th scope="col" data-wrap="true">
            Note
          </th>
          <th scope="col">Actions</th>
        </tr>
      </thead>
      <tbody>
        {reservations.map((reservation) => {
          const workerName = workerNameOr(workerNamesById, reservation.workerId);
          return (
            <tr key={reservation.reservationId}>
              {showAsset && (
                <td>
                  <Link href={`/assets/${encodeURIComponent(reservation.assetId)}`} className="mono">
                    {reservation.assetId}
                  </Link>
                </td>
              )}
              <td>
                <Link href={`/workers/${encodeURIComponent(reservation.workerId)}`}>{workerName}</Link>
              </td>
              <td>
                <Instant iso={reservation.startsAt} />
              </td>
              <td>
                <Instant iso={reservation.endsAt} />
              </td>
              <td>
                <span className={styles.statusCell}>
                  <ReservationStatusBadge status={reservation.status} />
                  {reservation.standing && (
                    <span className="muted">{RESERVATION_STANDING_LABELS[reservation.standing]}</span>
                  )}
                </span>
              </td>
              <td data-wrap="true">
                {reservation.note ?? <span className="muted">–</span>}
                {reservation.closedReason && (
                  <span className={styles.closedReason}>{reservation.closedReason}</span>
                )}
              </td>
              <td>
                {reservation.status === 'active' ? (
                  <CancelReservationButton reservation={reservation} workerName={workerName} />
                ) : (
                  <span className="muted">–</span>
                )}
              </td>
            </tr>
          );
        })}
      </tbody>
    </DataTable>
  );
}
