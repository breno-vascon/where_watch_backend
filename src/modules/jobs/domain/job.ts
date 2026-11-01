/**
 * Contrato de um job agendado. Jobs são executados pelo `tick`
 * (POST /internal/jobs/tick, disparado pelo pg_cron) ou manualmente.
 */
export type JobSchedule =
  /** A cada N minutos (mínimo útil = intervalo do tick, 10 min). */
  | { kind: 'every'; minutes: number }
  /** Uma vez por dia, a partir do horário `HH:mm` no fuso APP_TIMEZONE. */
  | { kind: 'daily'; at: string };

export type JobTrigger = 'TICK' | 'MANUAL';

export type JobRunStatus = 'RUNNING' | 'SUCCESS' | 'FAILED' | 'SKIPPED_LOCKED';

export type JobStats = Record<string, unknown>;

export interface JobContext {
  trigger: JobTrigger;
  startedAt: Date;
}

export interface Job {
  /** Identificador único, em kebab-case (ex.: `sync-fixtures`). */
  readonly name: string;
  readonly schedule: JobSchedule;
  /**
   * Deve ser idempotente: rodar duas vezes não pode duplicar dados.
   * Retorna estatísticas da execução (gravadas em job_runs.stats).
   */
  run(context: JobContext): Promise<JobStats>;
}

export interface JobRunRecord {
  id: string;
  jobName: string;
  status: JobRunStatus;
  trigger: JobTrigger;
  startedAt: Date;
  finishedAt: Date | null;
  stats: JobStats | null;
  error: string | null;
}

/** Resultado de uma tentativa de execução. */
export type JobExecution =
  | { jobName: string; status: 'SUCCESS'; runId: string; stats: JobStats }
  | { jobName: string; status: 'FAILED'; runId: string; error: string }
  | { jobName: string; status: 'SKIPPED_LOCKED' };

const JOB_NAME_PATTERN = /^[a-z0-9]+(-[a-z0-9]+)*$/;
const DAILY_AT_PATTERN = /^([01]\d|2[0-3]):([0-5]\d)$/;

/** Retorna a lista de problemas da definição do job (vazia = válida). */
export function validateJobDefinition(
  job: Pick<Job, 'name' | 'schedule'>,
): string[] {
  const problems: string[] = [];

  if (!JOB_NAME_PATTERN.test(job.name)) {
    problems.push(`nome "${job.name}" deve estar em kebab-case`);
  }
  if (
    job.schedule.kind === 'every' &&
    !(Number.isInteger(job.schedule.minutes) && job.schedule.minutes > 0)
  ) {
    problems.push(`"${job.name}": minutes deve ser um inteiro positivo`);
  }
  if (
    job.schedule.kind === 'daily' &&
    !DAILY_AT_PATTERN.test(job.schedule.at)
  ) {
    problems.push(`"${job.name}": at deve estar no formato HH:mm`);
  }
  return problems;
}

/** Converte `HH:mm` em minutos desde a meia-noite. Assume formato já validado. */
export function dailyAtToMinutes(at: string): number {
  const [hours, minutes] = at.split(':').map(Number);
  return (hours ?? 0) * 60 + (minutes ?? 0);
}
