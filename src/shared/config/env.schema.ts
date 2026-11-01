import { z } from 'zod';

const isValidTimezone = (tz: string): boolean => {
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: tz });
    return true;
  } catch {
    return false;
  }
};

const booleanString = z
  .enum(['true', 'false'])
  .transform((value) => value === 'true');

export const envSchema = z.object({
  NODE_ENV: z
    .enum(['development', 'test', 'production'])
    .default('development'),
  PORT: z.coerce.number().int().positive().default(3000),
  LOG_LEVEL: z
    .enum(['trace', 'debug', 'info', 'warn', 'error', 'fatal'])
    .default('info'),
  APP_TIMEZONE: z
    .string()
    .default('America/Sao_Paulo')
    .refine(isValidTimezone, 'fuso horário IANA inválido'),
  SWAGGER_ENABLED: booleanString.optional(),
  DATABASE_URL: z.url({
    protocol: /^postgres(ql)?$/,
    error: 'deve ser uma URL postgres://',
  }),
  INTERNAL_JOBS_TOKEN: z.string().min(32, 'deve ter pelo menos 32 caracteres'),
});

export interface AppConfig {
  nodeEnv: 'development' | 'test' | 'production';
  port: number;
  logLevel: 'trace' | 'debug' | 'info' | 'warn' | 'error' | 'fatal';
  timezone: string;
  swaggerEnabled: boolean;
  databaseUrl: string;
  internalJobsToken: string;
}

/**
 * Valida as variáveis de ambiente. Lança um erro listando todas as variáveis
 * inválidas: a aplicação não sobe com configuração incompleta.
 */
export function loadConfig(env: NodeJS.ProcessEnv): AppConfig {
  const parsed = envSchema.safeParse(env);

  if (!parsed.success) {
    const problems = parsed.error.issues
      .map((issue) => `  - ${issue.path.join('.')}: ${issue.message}`)
      .join('\n');
    throw new Error(`Configuração inválida:\n${problems}`);
  }

  const e = parsed.data;
  return {
    nodeEnv: e.NODE_ENV,
    port: e.PORT,
    logLevel: e.LOG_LEVEL,
    timezone: e.APP_TIMEZONE,
    swaggerEnabled: e.SWAGGER_ENABLED ?? e.NODE_ENV !== 'production',
    databaseUrl: e.DATABASE_URL,
    internalJobsToken: e.INTERNAL_JOBS_TOKEN,
  };
}
