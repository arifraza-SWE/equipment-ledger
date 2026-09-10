import type { ApiError, ApiErrorCode } from '@equipment-ledger/shared';
import type { Response } from 'supertest';

export function expectApiError(
  response: Response,
  statusCode: number,
  code: ApiErrorCode,
): ApiError {
  const body = response.body as ApiError;
  expect({ status: response.status, code: body.code, message: body.message }).toMatchObject({
    status: statusCode,
    code,
  });
  expect(typeof body.message).toBe('string');
  expect(body.message.length).toBeGreaterThan(20);
  return body;
}
