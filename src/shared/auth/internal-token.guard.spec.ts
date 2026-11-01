import { type ExecutionContext, UnauthorizedException } from '@nestjs/common';
import type { AppConfig } from '../config/env.schema.js';
import { InternalTokenGuard } from './internal-token.guard.js';

const TOKEN = 'a'.repeat(40);

function contextWithHeader(value: string | undefined): ExecutionContext {
  const request = {
    header: (name: string) => (name === 'x-internal-token' ? value : undefined),
  };
  return {
    switchToHttp: () => ({ getRequest: () => request }),
  } as unknown as ExecutionContext;
}

describe('InternalTokenGuard', () => {
  const guard = new InternalTokenGuard({
    internalJobsToken: TOKEN,
  } as AppConfig);

  it('libera com o token correto', () => {
    expect(guard.canActivate(contextWithHeader(TOKEN))).toBe(true);
  });

  it('bloqueia sem token', () => {
    expect(() => guard.canActivate(contextWithHeader(undefined))).toThrow(
      UnauthorizedException,
    );
  });

  it('bloqueia com token errado, inclusive de tamanho diferente', () => {
    expect(() => guard.canActivate(contextWithHeader('b'.repeat(40)))).toThrow(
      UnauthorizedException,
    );
    expect(() => guard.canActivate(contextWithHeader('curto'))).toThrow(
      UnauthorizedException,
    );
  });
});
