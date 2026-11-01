import {
  type ArgumentsHost,
  Catch,
  type ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import type { Response } from 'express';
import {
  ConflictError,
  DomainError,
  NotFoundError,
  ValidationError,
} from './domain-error.js';

export interface ErrorBody {
  error: { code: string; message: string; details?: unknown };
}

/** Formato único de erro da API: `{ error: { code, message, details? } }`. */
@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const response = host.switchToHttp().getResponse<Response>();
    const { status, body } = this.toHttp(exception);

    if (status >= 500) {
      this.logger.error(
        exception instanceof Error ? exception.stack : String(exception),
      );
    }

    response.status(status).json(body);
  }

  private toHttp(exception: unknown): { status: number; body: ErrorBody } {
    if (exception instanceof DomainError) {
      return {
        status: domainErrorStatus(exception),
        body: { error: { code: exception.code, message: exception.message } },
      };
    }

    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const res = exception.getResponse();
      const message =
        typeof res === 'object' && res !== null && 'message' in res
          ? res.message
          : exception.message;

      return {
        status,
        body: {
          error: {
            code: HttpStatus[status] ?? 'HTTP_ERROR',
            // ValidationPipe devolve uma lista de mensagens: vai em `details`.
            message: Array.isArray(message)
              ? 'Dados de entrada inválidos'
              : String(message),
            ...(Array.isArray(message) ? { details: message } : {}),
          },
        },
      };
    }

    return {
      status: HttpStatus.INTERNAL_SERVER_ERROR,
      body: { error: { code: 'INTERNAL_ERROR', message: 'Erro interno' } },
    };
  }
}

function domainErrorStatus(error: DomainError): number {
  if (error instanceof NotFoundError) return HttpStatus.NOT_FOUND;
  if (error instanceof ValidationError) return HttpStatus.BAD_REQUEST;
  if (error instanceof ConflictError) return HttpStatus.CONFLICT;
  return HttpStatus.UNPROCESSABLE_ENTITY;
}
