import type {
  ChangeServiceStatusRequest,
  CorrectionResult,
  CorrectMovementRequest,
  IssueAssetRequest,
  MovementResult,
  ReturnAssetRequest,
  ServiceStatusChangeResult,
} from '@equipment-ledger/shared';
import { apiMutation, type MutationOutcome } from '@/lib/api-client';

export function issueAsset(
  request: IssueAssetRequest,
  idempotencyKey: string,
): Promise<MutationOutcome<MovementResult>> {
  return apiMutation<MovementResult>('/movements/issues', {
    method: 'POST',
    body: request,
    idempotencyKey,
  });
}

export function returnAsset(
  request: ReturnAssetRequest,
  idempotencyKey: string,
): Promise<MutationOutcome<MovementResult>> {
  return apiMutation<MovementResult>('/movements/returns', {
    method: 'POST',
    body: request,
    idempotencyKey,
  });
}

export function correctMovement(
  movementId: string,
  request: CorrectMovementRequest,
  idempotencyKey: string,
): Promise<MutationOutcome<CorrectionResult>> {
  return apiMutation<CorrectionResult>(`/movements/${encodeURIComponent(movementId)}/corrections`, {
    method: 'POST',
    body: request,
    idempotencyKey,
  });
}

export function changeServiceStatus(
  assetId: string,
  request: ChangeServiceStatusRequest,
  idempotencyKey: string,
): Promise<MutationOutcome<ServiceStatusChangeResult>> {
  return apiMutation<ServiceStatusChangeResult>(
    `/assets/${encodeURIComponent(assetId)}/service-status`,
    { method: 'POST', body: request, idempotencyKey },
  );
}
