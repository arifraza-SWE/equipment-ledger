import { type ArgumentsHost, Catch, type ExceptionFilter, Logger } from '@nestjs/common';
import type { Request, Response } from 'express';
import { toApiError } from './api-error.mapper';

@Catch()
export class ApiExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger('Api');

  catch(exception: unknown, host: ArgumentsHost): void {
    const http = host.switchToHttp();
    const response = http.getResponse<Response>();
    const request = http.getRequest<Request>();
    const apiError = toApiError(exception);

    if (apiError.statusCode >= 500) {
      this.logger.error(
        `${request.method} ${request.originalUrl} failed: ${describeUnknown(exception)}`,
        exception instanceof Error ? exception.stack : undefined,
      );
    } else {
      this.logger.warn(
        `${request.method} ${request.originalUrl} -> ${apiError.statusCode} ${apiError.code}: ${apiError.message}`,
      );
    }

    response.status(apiError.statusCode).json(apiError);
  }
}

function describeUnknown(exception: unknown): string {
  return exception instanceof Error ? exception.message : String(exception);
}
