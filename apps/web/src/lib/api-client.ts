import {
  IDEMPOTENCY_KEY_HEADER,
  IDEMPOTENCY_REPLAYED_HEADER,
  type ApiError,
  type ApiErrorCode,
} from '@equipment-ledger/shared';
import { apiBaseUrl } from './api-base-url';

export class ApiRequestError extends Error {
  constructor(
    readonly statusCode: number,
    readonly code: ApiErrorCode,
    message: string,
    readonly details?: Record<string, unknown>,
  ) {
    super(message);
    this.name = 'ApiRequestError';
  }
}

export class ApiUnreachableError extends Error {
  constructor(cause: unknown) {
    super(`The store API at ${apiBaseUrl} could not be reached.`, { cause });
    this.name = 'ApiUnreachableError';
  }
}

type QueryParams = Record<string, string | number | undefined>;

interface ApiRequestOptions {
  method?: 'GET' | 'POST' | 'DELETE';
  body?: unknown;
  query?: QueryParams;
  idempotencyKey?: string;
}

export interface MutationOutcome<TResult> {
  result: TResult;
  replayed: boolean;
}

export type RequestOutcome<TValue> =
  | { ok: true; value: TValue }
  | { ok: false; message: string; notFound: boolean };

export async function apiRequest<TResult>(
  path: string,
  options: ApiRequestOptions = {},
): Promise<TResult> {
  const { body } = await performRequest<TResult>(path, options);
  return body;
}

export async function apiMutation<TResult>(
  path: string,
  options: ApiRequestOptions & { idempotencyKey: string },
): Promise<MutationOutcome<TResult>> {
  const { body, replayed } = await performRequest<TResult>(path, options);
  return { result: body, replayed };
}

export async function attemptRequest<TValue>(
  load: () => Promise<TValue>,
): Promise<RequestOutcome<TValue>> {
  try {
    return { ok: true, value: await load() };
  } catch (error) {
    return { ok: false, message: describeRequestFailure(error), notFound: isNotFound(error) };
  }
}

export function describeRequestFailure(error: unknown): string {
  if (error instanceof ApiRequestError || error instanceof ApiUnreachableError) {
    return error.message;
  }
  return 'Something went wrong while talking to the store.';
}

async function performRequest<TResult>(
  path: string,
  options: ApiRequestOptions,
): Promise<{ body: TResult; replayed: boolean }> {
  const headers = new Headers({ Accept: 'application/json' });
  if (options.body !== undefined) {
    headers.set('Content-Type', 'application/json');
  }
  if (options.idempotencyKey) {
    headers.set(IDEMPOTENCY_KEY_HEADER, options.idempotencyKey);
  }

  let response: Response;
  try {
    response = await fetch(buildUrl(path, options.query), {
      method: options.method ?? 'GET',
      headers,
      body: options.body === undefined ? undefined : JSON.stringify(options.body),
      cache: 'no-store',
    });
  } catch (error) {
    throw new ApiUnreachableError(error);
  }

  if (!response.ok) {
    throw await readApiError(response);
  }
  return {
    body: (await response.json()) as TResult,
    replayed: response.headers.get(IDEMPOTENCY_REPLAYED_HEADER) === 'true',
  };
}

function buildUrl(path: string, query: QueryParams | undefined): string {
  const url = new URL(path, apiBaseUrl);
  for (const [name, parameter] of Object.entries(query ?? {})) {
    if (parameter !== undefined && parameter !== '') {
      url.searchParams.set(name, String(parameter));
    }
  }
  return url.toString();
}

async function readApiError(response: Response): Promise<ApiRequestError> {
  const payload: unknown = await response.json().catch(() => null);
  if (isApiError(payload)) {
    return new ApiRequestError(payload.statusCode, payload.code, payload.message, payload.details);
  }
  return new ApiRequestError(
    response.status,
    'internal_error',
    `The store API answered ${response.status} without a readable message.`,
  );
}

function isApiError(candidate: unknown): candidate is ApiError {
  return (
    typeof candidate === 'object' &&
    candidate !== null &&
    'statusCode' in candidate &&
    'code' in candidate &&
    'message' in candidate
  );
}

function isNotFound(error: unknown): boolean {
  return error instanceof ApiRequestError && error.statusCode === 404;
}
