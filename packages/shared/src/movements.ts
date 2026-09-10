export const MOVEMENT_TYPES = ['issue', 'return', 'out_of_service', 'back_in_service'] as const;

export type MovementType = (typeof MOVEMENT_TYPES)[number];

export const MOVEMENT_TYPE_LABELS: Record<MovementType, string> = {
  issue: 'Issued',
  return: 'Returned',
  out_of_service: 'Taken out of service',
  back_in_service: 'Back in service',
};

export interface Movement {
  movementId: string;
  assetId: string;
  type: MovementType;
  workerId: string | null;
  returnedByWorkerId: string | null;
  keeperId: string;
  effectiveAt: string;
  recordedAt: string;
  dueAt: string | null;
  reservationId: string | null;
  note: string | null;
  supersededByCorrectionId: string | null;
  createdByCorrectionId: string | null;
}

export const CORRECTION_KINDS = ['amend', 'void'] as const;

export type CorrectionKind = (typeof CORRECTION_KINDS)[number];

export const CORRECTABLE_FIELDS = [
  'effectiveAt',
  'workerId',
  'returnedByWorkerId',
  'dueAt',
  'note',
] as const;

export type CorrectableField = (typeof CORRECTABLE_FIELDS)[number];

export interface CorrectionChange {
  field: CorrectableField;
  from: string | null;
  to: string | null;
}

export interface Correction {
  correctionId: string;
  assetId: string;
  originalMovementId: string;
  replacementMovementId: string | null;
  kind: CorrectionKind;
  reason: string;
  keeperId: string;
  recordedAt: string;
  changes: CorrectionChange[];
}

export interface IssueAssetRequest {
  assetId: string;
  workerId: string;
  keeperId: string;
  effectiveAt: string;
  dueAt?: string | null;
  reservationId?: string | null;
  note?: string | null;
}

export interface ReturnAssetRequest {
  assetId: string;
  returnedByWorkerId: string;
  keeperId: string;
  effectiveAt: string;
  acknowledgeDifferentReturner?: boolean;
  takeOutOfService?: boolean;
  note?: string | null;
}

export interface CorrectMovementRequest {
  kind: CorrectionKind;
  reason: string;
  keeperId: string;
  effectiveAt?: string;
  workerId?: string;
  returnedByWorkerId?: string;
  dueAt?: string | null;
  note?: string | null;
}

export interface ChangeServiceStatusRequest {
  status: 'in_service' | 'out_of_service';
  keeperId: string;
  reason: string;
  effectiveAt: string;
}

export const ISSUE_RULES = {
  futureToleranceMinutes: 2,
  earlyCollectionGraceMinutes: 15,
  defaultLoanHours: 8,
} as const;
