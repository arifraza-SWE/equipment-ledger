import {
  type CallHandler,
  type ExecutionContext,
  HttpException,
  Inject,
  Injectable,
  type NestInterceptor,
} from '@nestjs/common';
import { HTTP_CODE_METADATA } from '@nestjs/common/constants';
import { Reflector } from '@nestjs/core';
import { IDEMPOTENCY_KEY_HEADER, IDEMPOTENCY_REPLAYED_HEADER } from '@equipment-ledger/shared';
import type { Request, Response } from 'express';
import { catchError, mergeMap, type Observable, of } from 'rxjs';
import { toApiError } from '../errors/api-error.mapper';
import { InvalidRequestError } from '../errors/domain-error';
import { CLOCK, type Clock } from '../time/clock';
import { IdempotencyService } from './idempotency.service';
import { fingerprintRequest } from './request-fingerprint';

const KEY_PATTERN = /^[A-Za-z0-9_-]{8,128}$/;

@Injectable()
export class IdempotencyInterceptor implements NestInterceptor {
  constructor(
    private readonly idempotency: IdempotencyService,
    private readonly reflector: Reflector,
    @Inject(CLOCK) private readonly clock: Clock,
  ) {}

  async intercept(context: ExecutionContext, next: CallHandler): Promise<Observable<unknown>> {
    const request = context.switchToHttp().getRequest<Request>();
    const response = context.switchToHttp().getResponse<Response>();
    const idempotencyKey = readIdempotencyKey(request);
    const requestFingerprint = fingerprintRequest(request.method, request.path, request.body);

    const claim = await this.idempotency.claim(
      idempotencyKey,
      requestFingerprint,
      this.clock.now(),
    );
    if (claim.kind === 'replay') {
      response.setHeader(IDEMPOTENCY_REPLAYED_HEADER, 'true');
      if (claim.response.statusCode >= 400) {
        throw new HttpException(
          claim.response.body as Record<string, unknown>,
          claim.response.statusCode,
        );
      }
      response.status(claim.response.statusCode);
      return of(claim.response.body);
    }

    const successStatusCode =
      this.reflector.get<number | undefined>(HTTP_CODE_METADATA, context.getHandler()) ??
      (request.method === 'POST' ? 201 : 200);

    return next.handle().pipe(
      mergeMap(async (body: unknown) => {
        await this.idempotency.complete(
          idempotencyKey,
          { statusCode: successStatusCode, body },
          this.clock.now(),
        );
        return body;
      }),
      catchError((error: unknown) => this.recordFailure(idempotencyKey, error)),
    );
  }

  private async recordFailure(idempotencyKey: string, error: unknown): Promise<never> {
    const apiError = toApiError(error);
    if (apiError.statusCode < 500) {
      await this.idempotency.complete(
        idempotencyKey,
        { statusCode: apiError.statusCode, body: apiError },
        this.clock.now(),
      );
    } else {
      await this.idempotency.release(idempotencyKey);
    }
    throw error;
  }
}

function readIdempotencyKey(request: Request): string {
  const headerValue = request.header(IDEMPOTENCY_KEY_HEADER);
  if (!headerValue) {
    throw new InvalidRequestError(
      'idempotency_key_missing',
      `This request changes the ledger and must carry an ${IDEMPOTENCY_KEY_HEADER} header (a UUID generated once per submission).`,
    );
  }
  if (!KEY_PATTERN.test(headerValue)) {
    throw new InvalidRequestError(
      'idempotency_key_missing',
      `${IDEMPOTENCY_KEY_HEADER} must be 8 to 128 characters of letters, digits, dashes or underscores.`,
    );
  }
  return headerValue;
}
