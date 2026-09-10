export function toDatetimeLocalValue(instant: Date): string {
  const pad = (component: number) => String(component).padStart(2, '0');
  return (
    `${instant.getFullYear()}-${pad(instant.getMonth() + 1)}-${pad(instant.getDate())}` +
    `T${pad(instant.getHours())}:${pad(instant.getMinutes())}`
  );
}

export function isoFromDatetimeLocal(inputValue: string): string | null {
  if (inputValue === '') {
    return null;
  }
  const parsed = new Date(inputValue);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
}

export function datetimeLocalFromIso(iso: string | null): string {
  if (iso === null) {
    return '';
  }
  const parsed = new Date(iso);
  return Number.isNaN(parsed.getTime()) ? '' : toDatetimeLocalValue(parsed);
}
