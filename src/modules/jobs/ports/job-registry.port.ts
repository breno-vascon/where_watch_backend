import type { Job } from '../domain/job.js';

export const JOB_REGISTRY = Symbol('JOB_REGISTRY');

/** Fonte dos jobs disponíveis na aplicação. */
export interface JobRegistryPort {
  list(): readonly Job[];
  find(name: string): Job | undefined;
}
