import type { ApiErrorCode } from '@equipment-ledger/shared';

export abstract class DomainError extends Error {
  abstract readonly statusCode: number;

  protected constructor(
    readonly code: ApiErrorCode,
    message: string,
    readonly details?: Record<string, unknown>,
  ) {
    super(message);
    this.name = new.target.name;
  }
}

export class NotFoundError extends DomainError {
  readonly statusCode = 404;

  constructor(message: string, details?: Record<string, unknown>) {
    super('not_found', message, details);
  }
}

export class InvalidRequestError extends DomainError {
  readonly statusCode = 400;

  constructor(code: ApiErrorCode, message: string, details?: Record<string, unknown>) {
    super(code, message, details);
  }
}

export class RuleViolationError extends DomainError {
  readonly statusCode = 422;

  constructor(code: ApiErrorCode, message: string, details?: Record<string, unknown>) {
    super(code, message, details);
  }
}

export class StateConflictError extends DomainError {
  readonly statusCode = 409;

  constructor(code: ApiErrorCode, message: string, details?: Record<string, unknown>) {
    super(code, message, details);
  }
}

export class ConcurrentModificationError extends StateConflictError {
  constructor(assetId: string) {
    super(
      'concurrent_modification',
      `Asset ${assetId} was changed by another request while this one was being checked. Nothing was recorded; please retry.`,
      { assetId },
    );
  }
}
