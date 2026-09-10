import { RESERVATION_STATUSES, type ReservationStatus } from '@equipment-ledger/shared';
import Link from 'next/link';
import { RESERVATION_STATUS_LABELS } from '@/components/ReservationStatusBadge';
import styles from './ReservationsTable.module.css';

export function ReservationStatusFilter({ current }: { current: ReservationStatus | null }) {
  return (
    <nav aria-label="Filter by status" className={styles.filter}>
      <Link
        href="/reservations"
        className={styles.filterLink}
        aria-current={current === null ? 'page' : undefined}
      >
        All
      </Link>
      {RESERVATION_STATUSES.map((status) => (
        <Link
          key={status}
          href={`/reservations?status=${status}`}
          className={styles.filterLink}
          aria-current={current === status ? 'page' : undefined}
        >
          {RESERVATION_STATUS_LABELS[status]}
        </Link>
      ))}
    </nav>
  );
}
