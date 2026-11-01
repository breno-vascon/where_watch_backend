import { Inject, Injectable } from '@nestjs/common';
import { APP_CONFIG } from '../../../shared/config/config.module.js';
import type { AppConfig } from '../../../shared/config/env.schema.js';
import { isJobDue } from '../domain/is-job-due.js';
import type { JobExecution } from '../domain/job.js';
import { CLOCK, type ClockPort } from '../ports/clock.port.js';
import {
  JOB_REGISTRY,
  type JobRegistryPort,
} from '../ports/job-registry.port.js';
import {
  JOB_RUN_REPOSITORY,
  type JobRunRepository,
} from '../ports/job-run.repository.js';
import { RunJobUseCase } from './run-job.usecase.js';

export interface TickSummary {
  at: Date;
  executions: JobExecution[];
}

/**
 * Chamado a cada ~10 min pelo pg_cron. Executa, em sequência, os jobs vencidos.
 * A falha de um job não impede os demais.
 */
@Injectable()
export class RunTickUseCase {
  constructor(
    @Inject(JOB_REGISTRY) private readonly registry: JobRegistryPort,
    @Inject(JOB_RUN_REPOSITORY) private readonly runs: JobRunRepository,
    @Inject(CLOCK) private readonly clock: ClockPort,
    @Inject(APP_CONFIG) private readonly config: AppConfig,
    @Inject(RunJobUseCase) private readonly runJob: RunJobUseCase,
  ) {}

  async execute(): Promise<TickSummary> {
    const now = this.clock.now();
    const jobs = this.registry.list();
    const lastSuccess = await this.runs.lastSuccessAt(
      jobs.map((job) => job.name),
    );

    const dueJobs = jobs.filter((job) =>
      isJobDue(
        job.schedule,
        lastSuccess.get(job.name) ?? null,
        now,
        this.config.timezone,
      ),
    );

    const executions: JobExecution[] = [];
    for (const job of dueJobs) {
      executions.push(await this.runJob.execute(job.name, 'TICK'));
    }

    return { at: now, executions };
  }
}
