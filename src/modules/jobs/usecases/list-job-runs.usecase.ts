import { Inject, Injectable } from '@nestjs/common';
import type { JobRunRecord } from '../domain/job.js';
import {
  JOB_RUN_REPOSITORY,
  type JobRunRepository,
} from '../ports/job-run.repository.js';

@Injectable()
export class ListJobRunsUseCase {
  constructor(
    @Inject(JOB_RUN_REPOSITORY) private readonly runs: JobRunRepository,
  ) {}

  execute(limit: number): Promise<JobRunRecord[]> {
    return this.runs.listRecent(limit);
  }
}
