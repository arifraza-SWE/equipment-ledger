import { describeInstantOn, endOfDayOn, formatDayOn, isoDateOn } from '@equipment-ledger/shared';

const DEFAULT_SITE_TIMEZONE = 'UTC';

/**
 * The site keeps one clock. The API stores instants in UTC and speaks about them on this clock,
 * which is the same one the screens use, so a refusal quoted by the keeper and the document in
 * Mongo can never disagree about which day something happened on.
 */
export function siteTimeZone(): string {
  return process.env.SITE_TIMEZONE ?? DEFAULT_SITE_TIMEZONE;
}

export function describeInstant(instant: Date): string {
  return describeInstantOn(instant, siteTimeZone());
}

export function describeDay(instant: Date): string {
  return formatDayOn(instant, siteTimeZone());
}

export function isoDate(instant: Date): string {
  return isoDateOn(instant, siteTimeZone());
}

export function endOfSiteDay(instant: Date): Date {
  return endOfDayOn(instant, siteTimeZone());
}
