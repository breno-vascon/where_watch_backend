import { Module } from '@nestjs/common';
import { DiscoveryModule } from '@nestjs/core';
import { InternalTokenGuard } from '../../shared/auth/internal-token.guard.js';
import { DiscoveryJobRegistry } from './adapters/discovery-job-registry.js';
import { PrismaJobRunRepository } from './adapters/prisma-job-run.repository.js';
import { SystemClock } from './adapters/system-clock.js';
import { InternalJobsController } from './controllers/internal-jobs.controller.js';
import { HeartbeatJob } from './jobs/heartbeat.job.js';
import { CLOCK } from './ports/clock.port.js';
import { JOB_REGISTRY } from './ports/job-registry.port.js';
import { JOB_RUN_REPOSITORY } from './ports/job-run.repository.js';
import { ListJobRunsUseCase } from './usecases/list-job-runs.usecase.js';
import { RunJobUseCase } from './usecases/run-job.usecase.js';
import { RunTickUseCase } from './usecases/run-tick.usecase.js';

/**
 * Orquestração de jobs (tick, lock, histórico). Jobs de outros módulos só
 * precisam ser providers marcados com @ScheduledJob(): o registro os descobre.
 */
@Module({
  imports: [DiscoveryModule],
  controllers: [InternalJobsController],
  providers: [
    RunTickUseCase,
    RunJobUseCase,
    ListJobRunsUseCase,
    InternalTokenGuard,
    HeartbeatJob,
    { provide: JOB_REGISTRY, useClass: DiscoveryJobRegistry },
    { provide: JOB_RUN_REPOSITORY, useClass: PrismaJobRunRepository },
    { provide: CLOCK, useClass: SystemClock },
  ],
})
export class JobsModule {}
