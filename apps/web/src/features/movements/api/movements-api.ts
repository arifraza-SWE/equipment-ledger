import type {
  ChangeServiceStatusRequest,
  CorrectionResult,
  CorrectMovementRequest,
  IssueAssetRequest,
  MovementResult,
  PaginatedMovements,
  ReturnAssetRequest,
  ServiceStatusChangeResult,
} from '@equipment-ledger/shared';
import { apiMutation, apiRequest, type MutationOutcome } from '@/lib/api-client';

/**
 * The movements list is the one collection that only ever grows, so it is read a page at a time
 * against a cursor rather than pulled whole.
 */
export function fetchMovements(options: {
  cursor?: string | undefined;
  limit: number;
}): Promise<PaginatedMovements> {
  return apiRequest<PaginatedMovements>('/ledger/movements', {
    query: { cursor: options.cursor, limit: options.limit },
  });
}

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
