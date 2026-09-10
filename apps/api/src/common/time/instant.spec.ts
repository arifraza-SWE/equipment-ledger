import { describeInstant, parseInstant } from './instant';

describe('parseInstant', () => {
  it('accepts ISO 8601 with Z or an offset', () => {
    expect(parseInstant('2026-09-10T07:30:00Z')?.toISOString()).toBe('2026-09-10T07:30:00.000Z');
    expect(parseInstant('2026-09-10T08:30:00+01:00')?.toISOString()).toBe(
      '2026-09-10T07:30:00.000Z',
    );
    expect(parseInstant('2026-09-10T07:30Z')?.toISOString()).toBe('2026-09-10T07:30:00.000Z');
  });

  it('rejects timestamps without a timezone, since the hatch and the server may disagree', () => {
    expect(parseInstant('2026-09-10T07:30:00')).toBeNull();
  });

  it('rejects dates without a time, numbers and nonsense', () => {
    expect(parseInstant('2026-09-10')).toBeNull();
    expect(parseInstant('1757489400000')).toBeNull();
    expect(parseInstant('yesterday')).toBeNull();
    expect(parseInstant('2026-13-40T07:30:00Z')).toBeNull();
  });
});

describe('describeInstant', () => {
  it('reads as a time on a date, in UTC', () => {
    expect(describeInstant(new Date('2026-09-10T07:30:00Z'))).toBe('07:30 UTC on 2026-09-10');
  });
});
