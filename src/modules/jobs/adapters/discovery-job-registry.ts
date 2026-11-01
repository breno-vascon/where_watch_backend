import { Inject, Injectable, type OnModuleInit } from '@nestjs/common';
import { DiscoveryService, Reflector } from '@nestjs/core';
import { type Job, validateJobDefinition } from '../domain/job.js';
import type { JobRegistryPort } from '../ports/job-registry.port.js';
import { SCHEDULED_JOB_METADATA } from '../scheduled-job.decorator.js';

/** Encontra, ao subir a aplicação, todos os providers marcados com @ScheduledJob(). */
@Injectable()
export class DiscoveryJobRegistry implements JobRegistryPort, OnModuleInit {
  private jobs = new Map<string, Job>();

  constructor(
    @Inject(DiscoveryService) private readonly discovery: DiscoveryService,
    @Inject(Reflector) private readonly reflector: Reflector,
  ) {}

  onModuleInit(): void {
    const found = this.discovery
      .getProviders()
      .filter((wrapper) => wrapper.metatype && wrapper.instance)
      .filter((wrapper) =>
        this.reflector.get<boolean>(
          SCHEDULED_JOB_METADATA,
          wrapper.metatype as NonNullable<typeof wrapper.metatype>,
        ),
      )
      .map((wrapper) => wrapper.instance as Job);

    this.jobs = buildJobMap(found);
  }

  list(): readonly Job[] {
    return [...this.jobs.values()];
  }

  find(name: string): Job | undefined {
    return this.jobs.get(name);
  }
}

/** Valida as definições e falha ao subir se houver erro ou nome duplicado. */
export function buildJobMap(jobs: readonly Job[]): Map<string, Job> {
  const problems: string[] = [];
  const map = new Map<string, Job>();

  for (const job of jobs) {
    problems.push(...validateJobDefinition(job));
    if (map.has(job.name))
      problems.push(`job "${job.name}" registrado mais de uma vez`);
    map.set(job.name, job);
  }

  if (problems.length > 0) {
    throw new Error(
      `Jobs inválidos:\n${problems.map((p) => `  - ${p}`).join('\n')}`,
    );
  }
  return map;
}
