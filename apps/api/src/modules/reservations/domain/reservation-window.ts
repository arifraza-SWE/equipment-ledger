import { RESERVATION_RULES } from '@equipment-ledger/shared';
import { days, minutes } from '../../../common/time/instant';

export interface ReservationWindow {
  startsAt: Date;
  endsAt: Date;
}

export type ReservationWindowProblem =
  | { kind: 'ends_before_starts' }
  | { kind: 'starts_in_past'; now: Date }
  | { kind: 'too_short'; minimumMinutes: number }
  | { kind: 'too_long'; maximumDays: number }
  | { kind: 'too_far_ahead'; maximumDays: number };

export function findReservationWindowProblem(
  window: ReservationWindow,
  now: Date,
): ReservationWindowProblem | null {
  const durationMillis = window.endsAt.getTime() - window.startsAt.getTime();
  if (durationMillis <= 0) {
    return { kind: 'ends_before_starts' };
  }
  if (window.startsAt.getTime() < now.getTime() - minutes(RESERVATION_RULES.pastToleranceMinutes)) {
    return { kind: 'starts_in_past', now };
  }
  if (durationMillis < minutes(RESERVATION_RULES.minDurationMinutes)) {
    return { kind: 'too_short', minimumMinutes: RESERVATION_RULES.minDurationMinutes };
  }
  if (durationMillis > days(RESERVATION_RULES.maxDurationDays)) {
    return { kind: 'too_long', maximumDays: RESERVATION_RULES.maxDurationDays };
  }
  if (window.startsAt.getTime() > now.getTime() + days(RESERVATION_RULES.maxLeadTimeDays)) {
    return { kind: 'too_far_ahead', maximumDays: RESERVATION_RULES.maxLeadTimeDays };
  }
  return null;
}

/** Half-open windows: 09:00-10:00 and 10:00-11:00 touch but do not overlap. */
export function windowsOverlap(left: ReservationWindow, right: ReservationWindow): boolean {
  return left.startsAt < right.endsAt && right.startsAt < left.endsAt;
}

export function describeWindowProblem(problem: ReservationWindowProblem): string {
  switch (problem.kind) {
    case 'ends_before_starts':
      return 'The reservation must end after it starts.';
    case 'starts_in_past':
      return 'A reservation is a claim on the future. To record equipment that has already gone out, issue it instead.';
    case 'too_short':
      return `A reservation must cover at least ${problem.minimumMinutes} minutes.`;
    case 'too_long':
      return `A reservation may cover at most ${problem.maximumDays} days. Split a longer need into consecutive reservations.`;
    case 'too_far_ahead':
      return `Reservations can be made up to ${problem.maximumDays} days ahead.`;
  }
}
