import { addDays, addMinutes, days } from '../common/time/instant';
import { endOfSiteDay } from '../config/site-time';

const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;

/** Midnight UTC of the seed's "today". Everything in the seed is placed relative to it. */
export function resolveSeedAnchor(override: string | undefined, now: Date): Date {
  if (override) {
    if (!DATE_ONLY.test(override) || Number.isNaN(Date.parse(`${override}T00:00:00Z`))) {
      throw new Error(`SEED_ANCHOR_DATE must be YYYY-MM-DD, got "${override}"`);
    }
    return new Date(`${override}T00:00:00Z`);
  }
  return new Date(Math.floor(now.getTime() / days(1)) * days(1));
}

export interface SeedClock {
  anchor: Date;
  /** dayOffset 0 is the anchor day; negative is the past. `clock` is "HH:MM". */
  at(dayOffset: number, clock: string): Date;
  endOfDay(dayOffset: number): Date;
  weekday(dayOffset: number): number;
}

export function seedClock(anchor: Date): SeedClock {
  return {
    anchor,
    at(dayOffset, clock) {
      const [hoursPart, minutesPart] = clock.split(':');
      const totalMinutes = Number(hoursPart) * 60 + Number(minutesPart);
      return addMinutes(addDays(anchor, dayOffset), totalMinutes);
    },
    endOfDay(dayOffset) {
      return endOfSiteDay(this.at(dayOffset, '12:00'));
    },
    weekday(dayOffset) {
      return addDays(anchor, dayOffset).getUTCDay();
    },
  };
}
