import { CheckHealthUseCase } from './check-health.usecase.js';

describe('CheckHealthUseCase', () => {
  it('retorna ok quando o banco responde', async () => {
    const useCase = new CheckHealthUseCase({
      ping: () => Promise.resolve(true),
    });

    await expect(useCase.execute()).resolves.toMatchObject({
      status: 'ok',
      db: 'ok',
    });
  });

  it('retorna degraded quando o banco não responde', async () => {
    const useCase = new CheckHealthUseCase({
      ping: () => Promise.resolve(false),
    });

    await expect(useCase.execute()).resolves.toMatchObject({
      status: 'degraded',
      db: 'down',
    });
  });
});
