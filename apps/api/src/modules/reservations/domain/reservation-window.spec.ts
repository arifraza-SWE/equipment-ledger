import {
  describeWindowProblem,
  findReservationWindowProblem,
  windowsOverlap,
} from './reservation-window';

const now = new Date('2026-09-10T12:00:00Z');

function window(startsAt: string, endsAt: string) {
  return { startsAt: new Date(startsAt), endsAt: new Date(endsAt) };
}

describe('reservation window rules', () => {
  it('accepts a sensible window in the near future', () => {
    expect(
      findReservationWindowProblem(window('2026-09-11T08:00:00Z', '2026-09-11T12:00:00Z'), now),
    ).toBeNull();
  });

  it('rejects a window that ends before it starts', () => {
    expect(
      findReservationWindowProblem(window('2026-09-11T12:00:00Z', '2026-09-11T08:00:00Z'), now),
    ).toEqual({
      kind: 'ends_before_starts',
    });
  });

  it('rejects a zero-length window', () => {
    expect(
      findReservationWindowProblem(window('2026-09-11T08:00:00Z', '2026-09-11T08:00:00Z'), now),
    ).toEqual({
      kind: 'ends_before_starts',
    });
  });

  it('rejects a window that starts in the past', () => {
    expect(
      findReservationWindowProblem(window('2026-09-10T08:00:00Z', '2026-09-10T16:00:00Z'), now),
    ).toEqual({
      kind: 'starts_in_past',
      now,
    });
  });

  it('tolerates a start a minute ago, because clocks drift', () => {
    expect(
      findReservationWindowProblem(window('2026-09-10T11:59:00Z', '2026-09-10T16:00:00Z'), now),
    ).toBeNull();
  });

  it('rejects a window shorter than the minimum', () => {
    expect(
      findReservationWindowProblem(window('2026-09-11T08:00:00Z', '2026-09-11T08:05:00Z'), now),
    ).toMatchObject({
      kind: 'too_short',
    });
  });

  it('rejects a whole year', () => {
    expect(
      findReservationWindowProblem(window('2026-09-11T08:00:00Z', '2027-09-11T08:00:00Z'), now),
    ).toMatchObject({
      kind: 'too_long',
      maximumDays: 14,
    });
  });

  it('rejects a start too far ahead', () => {
    expect(
      findReservationWindowProblem(window('2027-03-01T08:00:00Z', '2027-03-01T12:00:00Z'), now),
    ).toMatchObject({
      kind: 'too_far_ahead',
    });
  });

  it('describes every problem in plain words', () => {
    expect(describeWindowProblem({ kind: 'ends_before_starts' })).toMatch(/end after it starts/);
    expect(describeWindowProblem({ kind: 'too_long', maximumDays: 14 })).toMatch(/14 days/);
  });
});

describe('windowsOverlap', () => {
  const morning = window('2026-09-11T09:00:00Z', '2026-09-11T10:00:00Z');

  it('treats adjacent windows as not overlapping', () => {
    expect(windowsOverlap(morning, window('2026-09-11T10:00:00Z', '2026-09-11T11:00:00Z'))).toBe(
      false,
    );
  });

  it('detects a window that starts inside another', () => {
    expect(windowsOverlap(morning, window('2026-09-11T09:30:00Z', '2026-09-11T11:00:00Z'))).toBe(
      true,
    );
  });

  it('detects a window that contains another', () => {
    expect(windowsOverlap(morning, window('2026-09-11T08:00:00Z', '2026-09-11T12:00:00Z'))).toBe(
      true,
    );
  });

  it('is symmetric', () => {
    const later = window('2026-09-11T09:30:00Z', '2026-09-11T11:00:00Z');
    expect(windowsOverlap(later, morning)).toBe(windowsOverlap(morning, later));
  });
});
