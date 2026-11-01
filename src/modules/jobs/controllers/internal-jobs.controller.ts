import {
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Inject,
  Logger,
  Param,
  Post,
  Query,
  UseGuards,
  VERSION_NEUTRAL,
} from '@nestjs/common';
import {
  ApiAcceptedResponse,
  ApiOkResponse,
  ApiSecurity,
  ApiTags,
} from '@nestjs/swagger';
import { InternalTokenGuard } from '../../../shared/auth/internal-token.guard.js';
import type { JobExecution, JobRunRecord } from '../domain/job.js';
import { ListJobRunsUseCase } from '../usecases/list-job-runs.usecase.js';
import { RunJobUseCase } from '../usecases/run-job.usecase.js';
import { RunTickUseCase } from '../usecases/run-tick.usecase.js';
import {
  JobNameParamDto,
  ListJobRunsQueryDto,
} from './dto/internal-jobs.dto.js';

@ApiTags('internal')
@ApiSecurity('internal-token')
@UseGuards(InternalTokenGuard)
@Controller({ path: 'internal/jobs', version: VERSION_NEUTRAL })
export class InternalJobsController {
  private readonly logger = new Logger(InternalJobsController.name);

  constructor(
    @Inject(RunTickUseCase) private readonly runTick: RunTickUseCase,
    @Inject(RunJobUseCase) private readonly runJob: RunJobUseCase,
    @Inject(ListJobRunsUseCase)
    private readonly listJobRuns: ListJobRunsUseCase,
  ) {}

  /**
   * Responde 202 na hora e executa os jobs vencidos em seguida, no mesmo processo.
   * Assim o pg_net não fica esperando jobs longos.
   */
  @Post('tick')
  @HttpCode(HttpStatus.ACCEPTED)
  @ApiAcceptedResponse({
    description: 'Tick aceito; jobs vencidos serão executados.',
  })
  tick(): { accepted: true } {
    this.runTick
      .execute()
      .then((summary) => {
        if (summary.executions.length > 0) {
          this.logger.log(
            `Tick: ${summary.executions.map((e) => `${e.jobName}=${e.status}`).join(', ')}`,
          );
        }
      })
      .catch((error: unknown) => {
        this.logger.error(
          `Tick falhou: ${error instanceof Error ? error.stack : String(error)}`,
        );
      });

    return { accepted: true };
  }

  @Post(':name/run')
  @HttpCode(HttpStatus.OK)
  @ApiOkResponse({ description: 'Resultado da execução manual.' })
  run(@Param() params: JobNameParamDto): Promise<JobExecution> {
    return this.runJob.execute(params.name, 'MANUAL');
  }

  @Get('runs')
  @ApiOkResponse({
    description: 'Últimas execuções, da mais recente para a mais antiga.',
  })
  runs(@Query() query: ListJobRunsQueryDto): Promise<JobRunRecord[]> {
    return this.listJobRuns.execute(query.limit);
  }
}
