import { HttpException } from '@nestjs/common';
import type { ApiError } from '@equipment-ledger/shared';
import { DomainError } from './domain-error';

export function toApiError(exception: unknown): ApiError {
  if (exception instanceof DomainError) {
    return {
      statusCode: exception.statusCode,
      code: exception.code,
      message: exception.message,
      ...(exception.details ? { details: exception.details } : {}),
    };
  }
  if (exception instanceof HttpException) {
    return fromHttpException(exception);
  }
  const oversized = payloadTooLarge(exception);
  if (oversized) {
    return oversized;
  }
  return {
    statusCode: 500,
    code: 'internal_error',
    message: 'The store could not process this request. Nothing was recorded.',
  };
}

/** The JSON body parser rejects oversized bodies before any handler sees them. */
function payloadTooLarge(exception: unknown): ApiError | null {
  if (
    typeof exception !== 'object' ||
    exception === null ||
    !('type' in exception) ||
    exception.type !== 'entity.too.large'
  ) {
    return null;
  }
  return {
    statusCode: 413,
    code: 'validation_failed',
    message: 'That request is too large for the hatch. A note may be at most 500 characters.',
  };
}

export function isApiError(candidate: unknown): candidate is ApiError {
  return (
    typeof candidate === 'object' &&
    candidate !== null &&
    'statusCode' in candidate &&
    'code' in candidate &&
    'message' in candidate
  );
}

function fromHttpException(exception: HttpException): ApiError {
  const statusCode = exception.getStatus();
  const body = exception.getResponse();

  if (isApiError(body)) {
    return body;
  }

  if (statusCode === 400) {
    const problems = extractValidationMessages(body);
    return {
      statusCode,
      code: 'validation_failed',
      message: problems.length > 0 ? problems.join('; ') : 'The request is not valid.',
      details: { problems },
    };
  }

  if (statusCode === 404) {
    return { statusCode, code: 'not_found', message: 'No such route.' };
  }

  return {
    statusCode,
    code: statusCode >= 500 ? 'internal_error' : 'validation_failed',
    message: typeof body === 'string' ? body : exception.message,
  };
}

function extractValidationMessages(body: unknown): string[] {
  if (typeof body !== 'object' || body === null || !('message' in body)) {
    return [];
  }
  const message = body.message;
  if (Array.isArray(message)) {
    return message.filter((entry): entry is string => typeof entry === 'string');
  }
  return typeof message === 'string' ? [message] : [];
}
