const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export function formatInstant(iso: string): string {
  const instant = new Date(iso);
  if (Number.isNaN(instant.getTime())) {
    return iso;
  }
  return `${formatDate(instant)}, ${formatClock(instant)} ${zoneAbbreviation(instant)}`;
}

export function formatDay(iso: string): string {
  const instant = new Date(iso);
  return Number.isNaN(instant.getTime()) ? iso : formatDate(instant);
}

export function formatClock(instant: Date): string {
  return `${pad(instant.getHours())}:${pad(instant.getMinutes())}`;
}

function formatDate(instant: Date): string {
  const weekday = WEEKDAYS[instant.getDay()] ?? '';
  const month = MONTHS[instant.getMonth()] ?? '';
  return `${weekday} ${instant.getDate()} ${month} ${instant.getFullYear()}`;
}

function zoneAbbreviation(instant: Date): string {
  const zonePart = new Intl.DateTimeFormat('en-GB', { timeZoneName: 'short' })
    .formatToParts(instant)
    .find((part) => part.type === 'timeZoneName');
  return zonePart?.value ?? 'UTC';
}

function pad(component: number): string {
  return String(component).padStart(2, '0');
}
