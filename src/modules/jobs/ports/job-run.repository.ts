import type { JobRunRecord, JobStats, JobTrigger } from '../domain/job.js';

export const JOB_RUN_REPOSITORY = Symbol('JOB_RUN_REPOSITORY');

export type JobRunOutcome =
  { status: 'SUCCESS'; stats: JobStats } | { status: 'FAILED'; error: string };

/** Histórico de execuções (tabela job_runs). Também funciona como lock. */
export interface JobRunRepository {
  /**
   * Registra o início de uma execução de forma atômica.
   * Retorna o id da execução, ou `null` se já existe uma execução RUNNING
   * desse job iniciada há menos de `staleAfterMs` (job "travado").
   */
  tryStart(
    jobName: string,
    trigger: JobTrigger,
    staleAfterMs: number,
  ): Promise<string | null>;

  finish(runId: string, outcome: JobRunOutcome): Promise<void>;

  /** Registra que a execução foi pulada porque o job já estava rodando. */
  recordSkipped(jobName: string, trigger: JobTrigger): Promise<void>;

  /** Data da última execução SUCCESS de cada job (ausente = nunca rodou). */
  lastSuccessAt(jobNames: readonly string[]): Promise<Map<string, Date>>;

  listRecent(limit: number): Promise<JobRunRecord[]>;
}
