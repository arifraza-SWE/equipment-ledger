import {
  findTimelineViolation,
  replayTimeline,
  sortTimeline,
  stateAt,
  type TimelineEntry,
  withEntryReplaced,
} from './asset-timeline';

function entry(
  movementId: string,
  type: TimelineEntry['type'],
  effectiveAt: string,
  sequence: number,
  workerId: string | null = 'WKR-001',
): TimelineEntry {
  return {
    movementId,
    type,
    effectiveAt: new Date(effectiveAt),
    sequence,
    workerId,
    dueAt: null,
    reservationId: null,
  };
}

const issue = entry('m1', 'issue', '2026-09-08T09:00:00Z', 1);
const returned = entry('m2', 'return', '2026-09-08T16:00:00Z', 2);

describe('asset timeline', () => {
  describe('sortTimeline', () => {
    it('orders by effective time, then by sequence for the same instant', () => {
      const laterSequence = entry('a', 'issue', '2026-09-08T10:00:00Z', 5);
      const earlierSequence = entry('b', 'return', '2026-09-08T10:00:00Z', 4);
      const later = entry('c', 'issue', '2026-09-08T11:00:00Z', 1);
      expect(
        sortTimeline([later, laterSequence, earlierSequence]).map((sorted) => sorted.movementId),
      ).toEqual(['b', 'a', 'c']);
    });
  });

  describe('replayTimeline', () => {
    it('reports nobody holding an asset with no entries', () => {
      expect(replayTimeline([])).toEqual({
        holding: null,
        serviceStatus: 'in_service',
        serviceChangedBy: null,
        lastEntry: null,
      });
    });

    it('reports the open issue as the holding', () => {
      expect(replayTimeline([issue]).holding).toBe(issue);
    });

    it('clears the holding after a return', () => {
      expect(replayTimeline([issue, returned]).holding).toBeNull();
    });

    it('tracks service status independently of the holding', () => {
      const withdrawn = entry('m3', 'out_of_service', '2026-09-08T12:00:00Z', 2, null);
      const state = replayTimeline([issue, withdrawn]);
      expect(state.holding).toBe(issue);
      expect(state.serviceStatus).toBe('out_of_service');
      expect(state.serviceChangedBy).toBe(withdrawn);
    });
  });

  describe('stateAt', () => {
    const timeline = [issue, returned];

    it('is in store before the issue', () => {
      expect(stateAt(timeline, new Date('2026-09-08T08:59:59Z')).holding).toBeNull();
    });

    it('is held at exactly the issue instant', () => {
      expect(stateAt(timeline, new Date('2026-09-08T09:00:00Z')).holding).toBe(issue);
    });

    it('is held between issue and return', () => {
      expect(stateAt(timeline, new Date('2026-09-08T12:00:00Z')).holding).toBe(issue);
    });

    it('is in store at exactly the return instant', () => {
      expect(stateAt(timeline, new Date('2026-09-08T16:00:00Z')).holding).toBeNull();
    });
  });

  describe('findTimelineViolation', () => {
    it('accepts an alternating sequence of issues and returns', () => {
      const secondIssue = entry('m3', 'issue', '2026-09-09T09:00:00Z', 3, 'WKR-002');
      expect(findTimelineViolation([issue, returned, secondIssue])).toBeNull();
    });

    it('accepts a new issue at the same instant as the previous return', () => {
      const backOut = entry('m3', 'issue', '2026-09-08T16:00:00Z', 3, 'WKR-002');
      expect(findTimelineViolation([issue, returned, backOut])).toBeNull();
    });

    it('rejects an issue while the asset is already held', () => {
      const clash = entry('m3', 'issue', '2026-09-08T10:00:00Z', 3, 'WKR-002');
      expect(findTimelineViolation(sortTimeline([issue, clash, returned]))).toMatchObject({
        kind: 'issue_while_held',
        holdingEntry: issue,
      });
    });

    it('rejects a return with no issue before it', () => {
      const orphan = entry('m0', 'return', '2026-09-08T08:00:00Z', 0);
      expect(findTimelineViolation([orphan, issue])).toMatchObject({
        kind: 'return_without_issue',
        previousReturn: null,
      });
    });

    it('rejects a second return for the same issue and names the first', () => {
      const again = entry('m3', 'return', '2026-09-08T17:00:00Z', 3);
      expect(findTimelineViolation([issue, returned, again])).toMatchObject({
        kind: 'return_without_issue',
        previousReturn: returned,
      });
    });

    it('rejects a return at exactly the issue instant', () => {
      const sameInstant = entry('m2', 'return', '2026-09-08T09:00:00Z', 2);
      expect(findTimelineViolation([issue, sameInstant])).toMatchObject({
        kind: 'return_not_after_issue',
        issueEntry: issue,
      });
    });

    it('rejects an issue while out of service', () => {
      const withdrawn = entry('w1', 'out_of_service', '2026-09-08T17:00:00Z', 3, null);
      const attempt = entry('m3', 'issue', '2026-09-09T09:00:00Z', 4, 'WKR-002');
      expect(findTimelineViolation([issue, returned, withdrawn, attempt])).toMatchObject({
        kind: 'issue_while_out_of_service',
        withdrawalEntry: withdrawn,
      });
    });

    it('allows an issue again once the asset is back in service', () => {
      const withdrawn = entry('w1', 'out_of_service', '2026-09-08T17:00:00Z', 3, null);
      const restored = entry('w2', 'back_in_service', '2026-09-09T08:00:00Z', 4, null);
      const attempt = entry('m3', 'issue', '2026-09-09T09:00:00Z', 5, 'WKR-002');
      expect(findTimelineViolation([issue, returned, withdrawn, restored, attempt])).toBeNull();
    });

    it('rejects withdrawing an asset that is already out of service', () => {
      const first = entry('w1', 'out_of_service', '2026-09-08T17:00:00Z', 1, null);
      const second = entry('w2', 'out_of_service', '2026-09-08T18:00:00Z', 2, null);
      expect(findTimelineViolation([first, second])).toMatchObject({
        kind: 'already_out_of_service',
        withdrawalEntry: first,
      });
    });

    it('rejects restoring an asset that is already in service', () => {
      const restore = entry('w1', 'back_in_service', '2026-09-08T17:00:00Z', 1, null);
      expect(findTimelineViolation([restore])).toMatchObject({ kind: 'already_in_service' });
    });
  });

  describe('withEntryReplaced', () => {
    it('swaps the entry in place and re-sorts', () => {
      const earlierReturn = { ...returned, effectiveAt: new Date('2026-09-08T15:30:00Z') };
      expect(withEntryReplaced([issue, returned], 'm2', earlierReturn)).toEqual([
        issue,
        earlierReturn,
      ]);
    });

    it('drops the entry when the replacement is null', () => {
      expect(withEntryReplaced([issue, returned], 'm2', null)).toEqual([issue]);
    });
  });
});
