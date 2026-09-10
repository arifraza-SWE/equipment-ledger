import type { Clock } from '../../src/common/time/clock';

export class FakeClock implements Clock {
  private current: Date;

  constructor(initial: Date) {
    this.current = initial;
  }

  now(): Date {
    return new Date(this.current);
  }

  set(instant: Date): void {
    this.current = instant;
  }

  advanceMinutes(count: number): void {
    this.current = new Date(this.current.getTime() + count * 60_000);
  }
}
