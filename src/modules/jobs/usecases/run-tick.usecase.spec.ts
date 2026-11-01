import type { AppConfig } from '../../../shared/config/env.schema.js';
import { NotFoundError } from '../../../shared/errors/domain-error.js';
import { buildJobMap } from '../adapters/discovery-job-registry.js';
import { InMemoryJobRunRepository } from '../adapters/in-memory-job-run.repository.js';
import type { Job, JobSchedule } from '../domain/job.js';
import type { JobRegistryPort } from '../ports/job-registry.port.js';
import { RunJobUseCase } from './run-job.usecase.js';
import { RunTickUseCase } from './run-tick.usecase.js';

const NOW = new Date('2026-11-01T12:00:00Z');

function fakeJob(
  name: string,
  schedule: JobSchedule,
  impl: Job['run'] = () => Promise.resolve({}),
) {
  const run = vi.fn(impl);
  const job: Job = { name, schedule, run };
  return Object.assign(job, { runMock: run });
}

function setup(jobs: Job[]) {
  const map = buildJobMap(jobs);
  const registry: JobRegistryPort = {
    list: () => [...map.values()],
    find: (n) => map.get(n),
  };
  const runs = new InMemoryJobRunRepository(() => NOW);
  const clock = { now: () => NOW };
  const runJob = new RunJobUseCase(registry, runs, clock);
  const tick = new RunTickUseCase(
    registry,
    runs,
    clock,
    { timezone: 'America/Sao_Paulo' } as AppConfig,
    runJob,
  );
  return { runs, runJob, tick };
}

describe('RunTickUseCase', () => {
  it('executa só os jobs vencidos', async () => {
    const due = fakeJob('due-job', { kind: 'every', minutes: 10 });
    const notDue = fakeJob('not-due-job', { kind: 'every', minutes: 60 });
    const { runs, tick } = setup([due, notDue]);
    runs.records.push({
      id: 'old',
      jobName: 'not-due-job',
      trigger: 'TICK',
      status: 'SUCCESS',
      startedAt: new Date(NOW.getTime() - 5 * 60_000),
      finishedAt: NOW,
      stats: {},
      error: null,
    });

    const summary = await tick.execute();

    expect(summary.executions.map((e) => e.jobName)).toEqual(['due-job']);
    expect(due.runMock).toHaveBeenCalledOnce();
    expect(notDue.runMock).not.toHaveBeenCalled();
  });

  it('continua executando os demais quando um job falha', async () => {
    const failing = fakeJob('failing', { kind: 'every', minutes: 10 }, () =>
      Promise.reject(new Error('boom')),
    );
    const ok = fakeJob('ok', { kind: 'every', minutes: 10 }, () =>
      Promise.resolve({ items: 3 }),
    );
    const { runs, tick } = setup([failing, ok]);

    const summary = await tick.execute();

    expect(summary.executions).toEqual([
      expect.objectContaining({
        jobName: 'failing',
        status: 'FAILED',
        error: 'boom',
      }),
      expect.objectContaining({
        jobName: 'ok',
        status: 'SUCCESS',
        stats: { items: 3 },
      }),
    ]);
    expect(runs.records.map((r) => r.status).sort()).toEqual([
      'FAILED',
      'SUCCESS',
    ]);
  });

  it('pula o job que já está em execução', async () => {
    const job = fakeJob('busy', { kind: 'every', minutes: 10 });
    const { runs, tick } = setup([job]);
    runs.records.push({
      id: 'running',
      jobName: 'busy',
      trigger: 'TICK',
      status: 'RUNNING',
      startedAt: new Date(NOW.getTime() - 60_000),
      finishedAt: null,
      stats: null,
      error: null,
    });

    const summary = await tick.execute();

    expect(summary.executions).toEqual([
      { jobName: 'busy', status: 'SKIPPED_LOCKED' },
    ]);
    expect(job.runMock).not.toHaveBeenCalled();
  });

  it('ignora execução RUNNING abandonada (mais antiga que o limite)', async () => {
    const job = fakeJob('stale', { kind: 'every', minutes: 10 });
    const { runs, tick } = setup([job]);
    runs.records.push({
      id: 'abandoned',
      jobName: 'stale',
      trigger: 'TICK',
      status: 'RUNNING',
      startedAt: new Date(NOW.getTime() - 60 * 60_000),
      finishedAt: null,
      stats: null,
      error: null,
    });

    const summary = await tick.execute();

    expect(summary.executions[0]?.status).toBe('SUCCESS');
  });
});

describe('RunJobUseCase', () => {
  it('lança NotFoundError para job inexistente', async () => {
    const { runJob } = setup([]);

    await expect(runJob.execute('nao-existe', 'MANUAL')).rejects.toBeInstanceOf(
      NotFoundError,
    );
  });

  it('registra a execução manual com sucesso', async () => {
    const { runs, runJob } = setup([
      fakeJob('manual', { kind: 'daily', at: '04:00' }),
    ]);

    const result = await runJob.execute('manual', 'MANUAL');

    expect(result.status).toBe('SUCCESS');
    expect(runs.records[0]).toMatchObject({
      jobName: 'manual',
      trigger: 'MANUAL',
      status: 'SUCCESS',
    });
  });
});

describe('buildJobMap', () => {
  it('falha com nome duplicado', () => {
    const a = fakeJob('dup', { kind: 'every', minutes: 10 });
    expect(() => buildJobMap([a, { ...a }])).toThrow(/mais de uma vez/);
  });
});
