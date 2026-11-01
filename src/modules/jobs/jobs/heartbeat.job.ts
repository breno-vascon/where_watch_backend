import { Injectable } from '@nestjs/common';
import type { Job, JobSchedule, JobStats } from '../domain/job.js';
import { ScheduledJob } from '../scheduled-job.decorator.js';

/**
 * Job de verificação: roda a cada tick e não faz nada além de registrar
 * sucesso em job_runs. Linhas contínuas de `heartbeat` = pg_cron funcionando.
 */
@ScheduledJob()
@Injectable()
export class HeartbeatJob implements Job {
  readonly name = 'heartbeat';
  readonly schedule: JobSchedule = { kind: 'every', minutes: 10 };

  run(): Promise<JobStats> {
    return Promise.resolve({ ok: true });
  }
}
