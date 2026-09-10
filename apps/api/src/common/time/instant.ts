const ISO_INSTANT_PATTERN =
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d{1,3})?)?(Z|[+-]\d{2}:\d{2})$/;

export function parseInstant(candidate: string): Date | null {
  if (!ISO_INSTANT_PATTERN.test(candidate)) {
    return null;
  }
  const parsed = new Date(candidate);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

export function minutes(count: number): number {
  return count * 60_000;
}

export function hours(count: number): number {
  return count * 3_600_000;
}

export function days(count: number): number {
  return count * 86_400_000;
}

export function addMinutes(instant: Date, count: number): Date {
  return new Date(instant.getTime() + minutes(count));
}

export function addHours(instant: Date, count: number): Date {
  return new Date(instant.getTime() + hours(count));
}

export function addDays(instant: Date, count: number): Date {
  return new Date(instant.getTime() + days(count));
}

export function isBefore(left: Date, right: Date): boolean {
  return left.getTime() < right.getTime();
}

export function isSameInstant(left: Date, right: Date): boolean {
  return left.getTime() === right.getTime();
}
