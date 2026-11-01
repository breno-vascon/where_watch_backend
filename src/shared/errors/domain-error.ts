/**
 * Erros de negócio. TypeScript puro: podem ser lançados por domain e usecases.
 * O HttpExceptionFilter traduz cada tipo para o status HTTP correspondente.
 */
export abstract class DomainError extends Error {
  abstract readonly code: string;

  constructor(message: string) {
    super(message);
    this.name = new.target.name;
  }
}

export class NotFoundError extends DomainError {
  readonly code = 'NOT_FOUND';
}

export class ValidationError extends DomainError {
  readonly code = 'VALIDATION_ERROR';
}

export class ConflictError extends DomainError {
  readonly code = 'CONFLICT';
}
