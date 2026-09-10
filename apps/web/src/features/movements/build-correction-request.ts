import type { CorrectionKind, CorrectMovementRequest, Movement } from '@equipment-ledger/shared';
import { isoFromSiteWallClock } from '@/lib/site-time';

export interface CorrectionFormValues {
  kind: CorrectionKind;
  reason: string;
  effectiveAt: string;
  workerId: string;
  returnedByWorkerId: string;
  dueAt: string;
  note: string;
}

export function buildCorrectionRequest(
  original: Movement,
  values: CorrectionFormValues,
  keeperId: string,
): CorrectMovementRequest {
  const request: CorrectMovementRequest = {
    kind: values.kind,
    reason: values.reason.trim(),
    keeperId,
  };
  if (values.kind === 'void') {
    return request;
  }

  const effectiveAtIso = isoFromSiteWallClock(values.effectiveAt);
  if (effectiveAtIso !== null && effectiveAtIso !== normaliseIso(original.effectiveAt)) {
    request.effectiveAt = effectiveAtIso;
  }
  if (original.type === 'issue') {
    if (values.workerId && values.workerId !== original.workerId) {
      request.workerId = values.workerId;
    }
    const dueAtIso = isoFromSiteWallClock(values.dueAt);
    if (dueAtIso !== (original.dueAt === null ? null : normaliseIso(original.dueAt))) {
      request.dueAt = dueAtIso;
    }
  }
  if (
    original.type === 'return' &&
    values.returnedByWorkerId &&
    values.returnedByWorkerId !== original.returnedByWorkerId
  ) {
    request.returnedByWorkerId = values.returnedByWorkerId;
  }
  const note = values.note.trim() || null;
  if (note !== original.note) {
    request.note = note;
  }
  return request;
}

function normaliseIso(iso: string): string {
  return new Date(iso).toISOString();
}
