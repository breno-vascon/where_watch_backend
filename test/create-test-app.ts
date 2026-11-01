import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { AppModule } from '../src/app.module.js';
import { configureApp } from '../src/app.setup.js';
import { DATABASE_HEALTH } from '../src/modules/health/ports/database-health.port.js';
import { InMemoryJobRunRepository } from '../src/modules/jobs/adapters/in-memory-job-run.repository.js';
import { JOB_RUN_REPOSITORY } from '../src/modules/jobs/ports/job-run.repository.js';

export const TEST_INTERNAL_TOKEN = 't'.repeat(40);

export interface TestApp {
  app: INestApplication;
  jobRuns: InMemoryJobRunRepository;
  setDatabaseUp: (up: boolean) => void;
}

/**
 * Sobe a aplicação completa (mesma configuração HTTP da produção),
 * trocando apenas os adapters de banco por versões em memória.
 */
export async function createTestApp(): Promise<TestApp> {
  Object.assign(process.env, {
    NODE_ENV: 'test',
    LOG_LEVEL: 'fatal',
    DATABASE_URL: 'postgresql://test:test@localhost:5432/test',
    INTERNAL_JOBS_TOKEN: TEST_INTERNAL_TOKEN,
  });

  const jobRuns = new InMemoryJobRunRepository();
  let databaseUp = true;

  const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
    .overrideProvider(JOB_RUN_REPOSITORY)
    .useValue(jobRuns)
    .overrideProvider(DATABASE_HEALTH)
    .useValue({ ping: () => Promise.resolve(databaseUp) })
    .compile();

  const app = moduleRef.createNestApplication({ logger: false });
  configureApp(app);
  await app.init();

  return {
    app,
    jobRuns,
    setDatabaseUp: (up) => {
      databaseUp = up;
    },
  };
}
