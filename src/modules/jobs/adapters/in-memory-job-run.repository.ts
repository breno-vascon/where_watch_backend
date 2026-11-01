import { randomUUID } from 'node:crypto';
import type { JobRunRecord, JobTrigger } from '../domain/job.js';
import type {
  JobRunOutcome,
  JobRunRepository,
} from '../ports/job-run.repository.js';

/** Implementação em memória do histórico de jobs, para testes. */
export class InMemoryJobRunRepository implements JobRunRepository {
  readonly records: JobRunRecord[] = [];

  constructor(private readonly now: () => Date = () => new Date()) {}

  tryStart(
    jobName: string,
    trigger: JobTrigger,
    staleAfterMs: number,
  ): Promise<string | null> {
    const threshold = this.now().getTime() - staleAfterMs;
    const running = this.records.some(
      (r) =>
        r.jobName === jobName &&
        r.status === 'RUNNING' &&
        r.startedAt.getTime() > threshold,
    );
    if (running) return Promise.resolve(null);

    const id = randomUUID();
    this.records.push({
      id,
      jobName,
      trigger,
      status: 'RUNNING',
      startedAt: this.now(),
      finishedAt: null,
      stats: null,
      error: null,
    });
    return Promise.resolve(id);
  }

  finish(runId: string, outcome: JobRunOutcome): Promise<void> {
    const record = this.records.find((r) => r.id === runId);
    if (record) {
      record.status = outcome.status;
      record.finishedAt = this.now();
      if (outcome.status === 'SUCCESS') record.stats = outcome.stats;
      else record.error = outcome.error;
    }
    return Promise.resolve();
  }

  recordSkipped(jobName: string, trigger: JobTrigger): Promise<void> {
    this.records.push({
      id: randomUUID(),
      jobName,
      trigger,
      status: 'SKIPPED_LOCKED',
      startedAt: this.now(),
      finishedAt: this.now(),
      stats: null,
      error: null,
    });
    return Promise.resolve();
  }

  lastSuccessAt(jobNames: readonly string[]): Promise<Map<string, Date>> {
    const result = new Map<string, Date>();
    for (const r of this.records) {
      if (r.status !== 'SUCCESS' || !jobNames.includes(r.jobName)) continue;
      const current = result.get(r.jobName);
      if (!current || r.startedAt > current) result.set(r.jobName, r.startedAt);
    }
    return Promise.resolve(result);
  }

  listRecent(limit: number): Promise<JobRunRecord[]> {
    const sorted = [...this.records].sort(
      (a, b) => b.startedAt.getTime() - a.startedAt.getTime(),
    );
    return Promise.resolve(sorted.slice(0, limit));
  }
}
