import { Inject, Injectable, Logger } from '@nestjs/common';
import { NotFoundError } from '../../../shared/errors/domain-error.js';
import type { JobExecution, JobTrigger } from '../domain/job.js';
import { CLOCK, type ClockPort } from '../ports/clock.port.js';
import {
  JOB_REGISTRY,
  type JobRegistryPort,
} from '../ports/job-registry.port.js';
import {
  JOB_RUN_REPOSITORY,
  type JobRunRepository,
} from '../ports/job-run.repository.js';

/**
 * Uma execução RUNNING mais antiga que isso é considerada abandonada
 * (ex.: o Render reiniciou no meio do job) e não bloqueia novas execuções.
 */
export const STALE_RUN_AFTER_MS = 15 * 60_000;

/** Executa um job: trava, roda, registra o resultado. Nunca lança por falha do job. */
@Injectable()
export class RunJobUseCase {
  private readonly logger = new Logger(RunJobUseCase.name);

  constructor(
    @Inject(JOB_REGISTRY) private readonly registry: JobRegistryPort,
    @Inject(JOB_RUN_REPOSITORY) private readonly runs: JobRunRepository,
    @Inject(CLOCK) private readonly clock: ClockPort,
  ) {}

  async execute(jobName: string, trigger: JobTrigger): Promise<JobExecution> {
    const job = this.registry.find(jobName);
    if (!job) {
      throw new NotFoundError(`Job "${jobName}" não existe`);
    }

    const runId = await this.runs.tryStart(
      job.name,
      trigger,
      STALE_RUN_AFTER_MS,
    );
    if (!runId) {
      await this.runs.recordSkipped(job.name, trigger);
      this.logger.warn(`Job "${job.name}" ignorado: já está em execução`);
      return { jobName: job.name, status: 'SKIPPED_LOCKED' };
    }

    try {
      const stats = await job.run({ trigger, startedAt: this.clock.now() });
      await this.runs.finish(runId, { status: 'SUCCESS', stats });
      this.logger.log(`Job "${job.name}" concluído`);
      return { jobName: job.name, status: 'SUCCESS', runId, stats };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      await this.runs.finish(runId, { status: 'FAILED', error: message });
      this.logger.error(`Job "${job.name}" falhou: ${message}`);
      return { jobName: job.name, status: 'FAILED', runId, error: message };
    }
  }
}
