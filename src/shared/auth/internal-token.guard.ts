import { createHash, timingSafeEqual } from 'node:crypto';
import {
  type CanActivate,
  type ExecutionContext,
  Inject,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import type { Request } from 'express';
import { APP_CONFIG } from '../config/config.module.js';
import type { AppConfig } from '../config/env.schema.js';

export const INTERNAL_TOKEN_HEADER = 'x-internal-token';

/** Protege as rotas /internal/*: exige o header X-Internal-Token (usado pelo pg_cron). */
@Injectable()
export class InternalTokenGuard implements CanActivate {
  constructor(@Inject(APP_CONFIG) private readonly config: AppConfig) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<Request>();
    const received = request.header(INTERNAL_TOKEN_HEADER);

    if (!received || !safeEqual(received, this.config.internalJobsToken)) {
      throw new UnauthorizedException('Token interno inválido');
    }
    return true;
  }
}

/** Comparação em tempo constante. O hash iguala o tamanho dos buffers. */
function safeEqual(a: string, b: string): boolean {
  const hash = (value: string) => createHash('sha256').update(value).digest();
  return timingSafeEqual(hash(a), hash(b));
}
