import type { Reservation } from '@equipment-ledger/shared';
import { Field } from '@/components/Field';
import formStyles from '@/components/Form.module.css';
import { formatWindow } from '@/lib/site-time';

interface ReservationLinkFieldProps {
  reservations: Reservation[];
  value: string;
  onChange: (reservationId: string) => void;
}

export function ReservationLinkField({ reservations, value, onChange }: ReservationLinkFieldProps) {
  if (reservations.length === 0) {
    return (
      <p className={formStyles.hint}>
        No reservation by this worker for this asset. If one covers the issue time the store links
        it on its own.
      </p>
    );
  }

  return (
    <Field
      label="Reservation"
      optional
      hint="Leave on automatic and the store picks the reservation that covers the issue time."
    >
      {(control) => (
        <select
          id={control.id}
          className={formStyles.control}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          aria-describedby={control.describedBy}
        >
          <option value="">Automatic</option>
          {reservations.map((reservation) => (
            <option key={reservation.reservationId} value={reservation.reservationId}>
              {formatWindow(reservation.startsAt, reservation.endsAt)}
              {reservation.standing ? ` · ${reservation.standing}` : ''}
            </option>
          ))}
        </select>
      )}
    </Field>
  );
}
