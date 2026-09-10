const DEFAULT_SITE_TIMEZONE = 'UTC';

/**
 * One site, one clock. Every instant on screen is shown in the site's own timezone rather than
 * the timezone of whichever machine rendered it: the keeper and the server then read the same
 * wall clock, and a page rendered on the server hydrates in the browser without disagreeing
 * with itself.
 */
export const siteTimeZone = process.env.NEXT_PUBLIC_SITE_TIMEZONE ?? DEFAULT_SITE_TIMEZONE;

export interface SiteWallClock {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
}

export function formatInstant(iso: string): string {
  const instant = parse(iso);
  if (!instant) {
    return iso;
  }
  const wallClock = toSiteWallClock(instant);
  return `${formatDatePart(wallClock, true)}, ${formatClockPart(wallClock)} ${zoneAbbreviation(instant)}`;
}

/** For dense tables, where the page already says which day and zone the reader is looking at. */
export function formatInstantCompact(iso: string): string {
  const instant = parse(iso);
  if (!instant) {
    return iso;
  }
  const wallClock = toSiteWallClock(instant);
  return `${formatDatePart(wallClock, false)}, ${formatClockPart(wallClock)}`;
}

export function formatDay(iso: string): string {
  const instant = parse(iso);
  return instant ? formatDatePart(toSiteWallClock(instant), true) : iso;
}

export function formatWindow(startsAtIso: string, endsAtIso: string): string {
  const startsAt = parse(startsAtIso);
  const endsAt = parse(endsAtIso);
  if (!startsAt || !endsAt) {
    return `${startsAtIso} to ${endsAtIso}`;
  }
  const start = toSiteWallClock(startsAt);
  const end = toSiteWallClock(endsAt);
  const sameDay = start.year === end.year && start.month === end.month && start.day === end.day;
  return sameDay
    ? `${formatDatePart(start, false)}, ${formatClockPart(start)}–${formatClockPart(end)}`
    : `${formatInstantCompact(startsAtIso)} to ${formatInstantCompact(endsAtIso)}`;
}

export function siteWallClockNow(): string {
  return toDatetimeLocalValue(toSiteWallClock(new Date()));
}

export function siteWallClockFromIso(iso: string | null): string {
  if (iso === null) {
    return '';
  }
  const instant = parse(iso);
  return instant ? toDatetimeLocalValue(toSiteWallClock(instant)) : '';
}

/**
 * A datetime-local input hands back a naive "2026-09-10T09:00" with no zone. The keeper means
 * that time on the site's clock, so that is how it is read back into an instant.
 */
export function isoFromSiteWallClock(inputValue: string): string | null {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2})?$/.test(inputValue)) {
    return null;
  }
  const asIfUtc = Date.parse(`${inputValue}${inputValue.length === 16 ? ':00' : ''}Z`);
  if (Number.isNaN(asIfUtc)) {
    return null;
  }
  const firstGuess = new Date(asIfUtc - zoneOffsetMillis(new Date(asIfUtc)));
  const corrected = new Date(asIfUtc - zoneOffsetMillis(firstGuess));
  return corrected.toISOString();
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

const wallClockFormat = new Intl.DateTimeFormat('en-GB', {
  timeZone: siteTimeZone,
  hour12: false,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
});

const zoneFormat = new Intl.DateTimeFormat('en-GB', {
  timeZone: siteTimeZone,
  timeZoneName: 'short',
});

function toSiteWallClock(instant: Date): SiteWallClock {
  const parts = new Map(
    wallClockFormat.formatToParts(instant).map((part) => [part.type, part.value]),
  );
  return {
    year: Number(parts.get('year')),
    month: Number(parts.get('month')),
    day: Number(parts.get('day')),
    hour: Number(parts.get('hour')) % 24,
    minute: Number(parts.get('minute')),
    second: Number(parts.get('second')),
  };
}

function zoneOffsetMillis(instant: Date): number {
  const wallClock = toSiteWallClock(instant);
  const asUtc = Date.UTC(
    wallClock.year,
    wallClock.month - 1,
    wallClock.day,
    wallClock.hour,
    wallClock.minute,
    wallClock.second,
  );
  return asUtc - Math.floor(instant.getTime() / 1000) * 1000;
}

function formatDatePart(wallClock: SiteWallClock, withYear: boolean): string {
  const weekday = WEEKDAYS[weekdayIndex(wallClock)] ?? '';
  const month = MONTHS[wallClock.month - 1] ?? '';
  return withYear
    ? `${weekday} ${wallClock.day} ${month} ${wallClock.year}`
    : `${weekday} ${wallClock.day} ${month}`;
}

function formatClockPart(wallClock: SiteWallClock): string {
  return `${pad(wallClock.hour)}:${pad(wallClock.minute)}`;
}

function weekdayIndex(wallClock: SiteWallClock): number {
  return new Date(Date.UTC(wallClock.year, wallClock.month - 1, wallClock.day)).getUTCDay();
}

function zoneAbbreviation(instant: Date): string {
  const zonePart = zoneFormat.formatToParts(instant).find((part) => part.type === 'timeZoneName');
  return zonePart?.value ?? siteTimeZone;
}

function toDatetimeLocalValue(wallClock: SiteWallClock): string {
  return (
    `${wallClock.year}-${pad(wallClock.month)}-${pad(wallClock.day)}` +
    `T${pad(wallClock.hour)}:${pad(wallClock.minute)}`
  );
}

function parse(iso: string): Date | null {
  const instant = new Date(iso);
  return Number.isNaN(instant.getTime()) ? null : instant;
}

function pad(component: number): string {
  return String(component).padStart(2, '0');
}
