export interface WallClock {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

const wallClockFormats = new Map<string, Intl.DateTimeFormat>();
const zoneNameFormats = new Map<string, Intl.DateTimeFormat>();

export function toWallClock(instant: Date, timeZone: string): WallClock {
  const parts = new Map(
    wallClockFormat(timeZone)
      .formatToParts(instant)
      .map((part) => [part.type, part.value]),
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

export function zoneAbbreviation(instant: Date, timeZone: string): string {
  const zonePart = zoneNameFormat(timeZone)
    .formatToParts(instant)
    .find((part) => part.type === 'timeZoneName');
  return zonePart?.value ?? timeZone;
}

export function formatDayOn(instant: Date, timeZone: string): string {
  return describeDay(toWallClock(instant, timeZone), true);
}

/** "07:45 BST on Thu 10 Sep 2026", the form used in error messages. */
export function describeInstantOn(instant: Date, timeZone: string): string {
  const wallClock = toWallClock(instant, timeZone);
  return `${describeClock(wallClock)} ${zoneAbbreviation(instant, timeZone)} on ${describeDay(wallClock, true)}`;
}

export function formatInstantOn(instant: Date, timeZone: string): string {
  const wallClock = toWallClock(instant, timeZone);
  return `${describeDay(wallClock, true)}, ${describeClock(wallClock)} ${zoneAbbreviation(instant, timeZone)}`;
}

/** Without the year and the zone, for tables where the page already establishes both. */
export function formatInstantCompactOn(instant: Date, timeZone: string): string {
  const wallClock = toWallClock(instant, timeZone);
  return `${describeDay(wallClock, false)}, ${describeClock(wallClock)}`;
}

export function isoDateOn(instant: Date, timeZone: string): string {
  const wallClock = toWallClock(instant, timeZone);
  return `${wallClock.year}-${pad(wallClock.month)}-${pad(wallClock.day)}`;
}

export function endOfDayOn(instant: Date, timeZone: string): Date {
  const wallClock = toWallClock(instant, timeZone);
  const lastSecond = instantFromWallClock(
    { ...wallClock, hour: 23, minute: 59, second: 59 },
    timeZone,
  );
  return lastSecond;
}

/**
 * A wall clock has no zone of its own, so it is read as a time on the site's clock. The offset
 * is sampled twice because the offset at the guessed instant may itself be the wrong side of a
 * daylight-saving change.
 */
export function instantFromWallClock(wallClock: WallClock, timeZone: string): Date {
  const asIfUtc = Date.UTC(
    wallClock.year,
    wallClock.month - 1,
    wallClock.day,
    wallClock.hour,
    wallClock.minute,
    wallClock.second,
  );
  const firstGuess = new Date(asIfUtc - zoneOffsetMillis(new Date(asIfUtc), timeZone));
  return new Date(asIfUtc - zoneOffsetMillis(firstGuess, timeZone));
}

export function zoneOffsetMillis(instant: Date, timeZone: string): number {
  const wallClock = toWallClock(instant, timeZone);
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

function describeDay(wallClock: WallClock, withYear: boolean): string {
  const weekday = WEEKDAYS[weekdayIndex(wallClock)] ?? '';
  const month = MONTHS[wallClock.month - 1] ?? '';
  const withoutYear = `${weekday} ${wallClock.day} ${month}`;
  return withYear ? `${withoutYear} ${wallClock.year}` : withoutYear;
}

function describeClock(wallClock: WallClock): string {
  return `${pad(wallClock.hour)}:${pad(wallClock.minute)}`;
}

function weekdayIndex(wallClock: WallClock): number {
  return new Date(Date.UTC(wallClock.year, wallClock.month - 1, wallClock.day)).getUTCDay();
}

function wallClockFormat(timeZone: string): Intl.DateTimeFormat {
  const cached = wallClockFormats.get(timeZone);
  if (cached) {
    return cached;
  }
  const format = new Intl.DateTimeFormat('en-GB', {
    timeZone,
    hour12: false,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
  wallClockFormats.set(timeZone, format);
  return format;
}

function zoneNameFormat(timeZone: string): Intl.DateTimeFormat {
  const cached = zoneNameFormats.get(timeZone);
  if (cached) {
    return cached;
  }
  const format = new Intl.DateTimeFormat('en-GB', { timeZone, timeZoneName: 'short' });
  zoneNameFormats.set(timeZone, format);
  return format;
}

function pad(component: number): string {
  return String(component).padStart(2, '0');
}
