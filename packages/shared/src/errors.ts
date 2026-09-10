export const API_ERROR_CODES = [
  'validation_failed',
  'not_found',
  'asset_already_issued',
  'asset_not_issued',
  'asset_out_of_service',
  'asset_already_out_of_service',
  'asset_already_in_service',
  'certification_missing',
  'certification_expired',
  'timeline_conflict',
  'reservation_window_invalid',
  'reservation_overlap',
  'reservation_not_active',
  'reservation_mismatch',
  'asset_reserved_by_other',
  'returner_mismatch',
  'movement_already_corrected',
  'correction_invalid',
  'idempotency_key_missing',
  'idempotency_key_reused',
  'idempotency_in_progress',
  'concurrent_modification',
  'internal_error',
] as const;

export type ApiErrorCode = (typeof API_ERROR_CODES)[number];

export interface ApiError {
  statusCode: number;
  code: ApiErrorCode;
  message: string;
  details?: Record<string, unknown>;
}

export const IDEMPOTENCY_KEY_HEADER = 'idempotency-key';
export const IDEMPOTENCY_REPLAYED_HEADER = 'idempotency-replayed';
