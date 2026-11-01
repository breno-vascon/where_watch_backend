import { loadConfig } from './env.schema.js';

const validEnv = {
  DATABASE_URL: 'postgresql://user:pass@localhost:6543/postgres',
  INTERNAL_JOBS_TOKEN: 'x'.repeat(32),
};

describe('loadConfig', () => {
  it('aplica os valores padrão', () => {
    const config = loadConfig(validEnv);

    expect(config).toMatchObject({
      nodeEnv: 'development',
      port: 3000,
      logLevel: 'info',
      timezone: 'America/Sao_Paulo',
      swaggerEnabled: true,
    });
  });

  it('desliga o Swagger em produção por padrão', () => {
    expect(
      loadConfig({ ...validEnv, NODE_ENV: 'production' }).swaggerEnabled,
    ).toBe(false);
  });

  it('respeita SWAGGER_ENABLED explícito', () => {
    expect(
      loadConfig({
        ...validEnv,
        NODE_ENV: 'production',
        SWAGGER_ENABLED: 'true',
      }).swaggerEnabled,
    ).toBe(true);
  });

  it('lista todas as variáveis inválidas', () => {
    const load = () =>
      loadConfig({ INTERNAL_JOBS_TOKEN: 'curto', APP_TIMEZONE: 'Marte/Base' });

    expect(load).toThrow(/DATABASE_URL/);
    expect(load).toThrow(/APP_TIMEZONE/);
    expect(load).toThrow(/INTERNAL_JOBS_TOKEN/);
  });

  it('rejeita DATABASE_URL que não é postgres', () => {
    expect(() =>
      loadConfig({ ...validEnv, DATABASE_URL: 'mysql://localhost/db' }),
    ).toThrow(/DATABASE_URL/);
  });
});
