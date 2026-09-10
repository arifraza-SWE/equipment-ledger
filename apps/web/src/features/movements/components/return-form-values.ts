import type { AssetSnapshot } from '@equipment-ledger/shared';
import { describeAssetOption } from '@/features/assets/components/AssetField';

export interface ReturnFormValues {
  assetId: string;
  returnedByWorkerId: string;
  effectiveAt: string;
  acknowledgeDifferentReturner: boolean;
  takeOutOfService: boolean;
  note: string;
}

export type ReturnFieldErrors = Partial<
  Record<'assetId' | 'returnedByWorkerId' | 'effectiveAt' | 'note', string>
>;

export const EMPTY_RETURN_VALUES: ReturnFormValues = {
  assetId: '',
  returnedByWorkerId: '',
  effectiveAt: '',
  acknowledgeDifferentReturner: false,
  takeOutOfService: false,
  note: '',
};

export function describeHeldAsset(snapshot: AssetSnapshot): string {
  const holderName = snapshot.holding?.worker.fullName ?? 'unknown';
  return `${describeAssetOption(snapshot)} · held by ${holderName}`;
}

export function findReturnProblems(
  values: ReturnFormValues,
  effectiveAtIso: string | null,
): ReturnFieldErrors {
  const problems: ReturnFieldErrors = {};
  if (!values.assetId) {
    problems.assetId = 'Choose an asset.';
  }
  if (!values.returnedByWorkerId) {
    problems.returnedByWorkerId = 'Choose who handed it back.';
  }
  if (effectiveAtIso === null) {
    problems.effectiveAt = 'Enter when it came back.';
  }
  if (values.takeOutOfService && values.note.trim().length < 3) {
    problems.note = 'Say why it is being taken out of service.';
  }
  return problems;
}
