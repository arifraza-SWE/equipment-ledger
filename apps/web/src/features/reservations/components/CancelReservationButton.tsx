'use client';

import type { Reservation } from '@equipment-ledger/shared';
import { Button } from '@/components/Button';
import { useSelectedKeeper } from '@/components/KeeperProvider';
import { useLedgerSubmission } from '@/hooks/use-ledger-submission';
import { cancelReservation } from '../api/reservations-api';
import styles from './ReservationsTable.module.css';

interface CancelReservationButtonProps {
  reservation: Reservation;
  workerName: string;
}

export function CancelReservationButton({ reservation, workerName }: CancelReservationButtonProps) {
  const { selectedKeeper } = useSelectedKeeper();
  const submission = useLedgerSubmission<void, Reservation>(
    `cancel-reservation-${reservation.reservationId}`,
    (_request, idempotencyKey) => cancelReservation(reservation.reservationId, idempotencyKey),
  );

  const handleCancel = async () => {
    const confirmed = window.confirm(
      `Cancel the reservation of ${reservation.assetId} for ${workerName}?`,
    );
    if (confirmed) {
      await submission.submit();
    }
  };

  if (submission.state.phase === 'succeeded') {
    return <span className="muted">Cancelled</span>;
  }

  return (
    <span className={styles.cancelCell}>
      <Button
        variant="quiet"
        onClick={handleCancel}
        disabled={!submission.ready || submission.submitting || selectedKeeper === null}
        title={selectedKeeper === null ? 'Choose a keeper in the header first' : undefined}
      >
        {submission.submitting ? 'Cancelling…' : 'Cancel'}
      </Button>
      {(submission.state.phase === 'refused' || submission.state.phase === 'unconfirmed') && (
        <span className={styles.cancelMessage} role="status" aria-live="polite">
          {submission.state.message}
        </span>
      )}
    </span>
  );
}
