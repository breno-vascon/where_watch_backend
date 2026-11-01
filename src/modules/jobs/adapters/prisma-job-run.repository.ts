import { Inject, Injectable } from '@nestjs/common';
import type { JobRun } from '../../../generated/prisma/client.js';
import { PrismaService } from '../../../shared/database/prisma.service.js';
import type { JobRunRecord, JobStats, JobTrigger } from '../domain/job.js';
import type {
  JobRunOutcome,
  JobRunRepository,
} from '../ports/job-run.repository.js';

@Injectable()
export class PrismaJobRunRepository implements JobRunRepository {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  /**
   * Lock em uma única transação curta: compatível com o pooler do Supabase em
   * modo transaction (um advisory lock de sessão poderia cair em outra conexão).
   * O `pg_try_advisory_xact_lock` serializa o "verificar + inserir" entre ticks concorrentes.
   */
  tryStart(
    jobName: string,
    trigger: JobTrigger,
    staleAfterMs: number,
  ): Promise<string | null> {
    return this.prisma.$transaction(async (tx) => {
      const [lock] = await tx.$queryRaw<{ locked: boolean }[]>`
        SELECT pg_try_advisory_xact_lock(hashtext(${`job:${jobName}`})) AS locked`;
      if (!lock?.locked) return null;

      const running = await tx.jobRun.findFirst({
        where: {
          jobName,
          status: 'RUNNING',
          startedAt: { gt: new Date(Date.now() - staleAfterMs) },
        },
        select: { id: true },
      });
      if (running) return null;

      const created = await tx.jobRun.create({
        data: { jobName, trigger, status: 'RUNNING' },
        select: { id: true },
      });
      return created.id;
    });
  }

  async finish(runId: string, outcome: JobRunOutcome): Promise<void> {
    await this.prisma.jobRun.update({
      where: { id: runId },
      data: {
        status: outcome.status,
        finishedAt: new Date(),
        ...(outcome.status === 'SUCCESS'
          ? { stats: outcome.stats as object }
          : { error: outcome.error }),
      },
    });
  }

  async recordSkipped(jobName: string, trigger: JobTrigger): Promise<void> {
    await this.prisma.jobRun.create({
      data: {
        jobName,
        trigger,
        status: 'SKIPPED_LOCKED',
        finishedAt: new Date(),
      },
    });
  }

  async lastSuccessAt(jobNames: readonly string[]): Promise<Map<string, Date>> {
    if (jobNames.length === 0) return new Map();

    const rows = await this.prisma.jobRun.groupBy({
      by: ['jobName'],
      where: { jobName: { in: [...jobNames] }, status: 'SUCCESS' },
      _max: { startedAt: true },
    });

    return new Map(
      rows.flatMap((row) =>
        row._max.startedAt ? [[row.jobName, row._max.startedAt] as const] : [],
      ),
    );
  }

  async listRecent(limit: number): Promise<JobRunRecord[]> {
    const rows = await this.prisma.jobRun.findMany({
      orderBy: { startedAt: 'desc' },
      take: limit,
    });
    return rows.map(toRecord);
  }
}

function toRecord(row: JobRun): JobRunRecord {
  return {
    id: row.id,
    jobName: row.jobName,
    status: row.status,
    trigger: row.trigger,
    startedAt: row.startedAt,
    finishedAt: row.finishedAt,
    stats: (row.stats as JobStats | null) ?? null,
    error: row.error,
  };
}
