import { Controller, Get, Inject, VERSION_NEUTRAL } from '@nestjs/common';
import { ApiOkResponse, ApiTags } from '@nestjs/swagger';
import {
  CheckHealthUseCase,
  type HealthReport,
} from '../usecases/check-health.usecase.js';
import { HealthResponseDto } from './dto/health-response.dto.js';

@ApiTags('health')
@Controller({ path: 'health', version: VERSION_NEUTRAL })
export class HealthController {
  constructor(
    @Inject(CheckHealthUseCase)
    private readonly checkHealth: CheckHealthUseCase,
  ) {}

  @Get()
  @ApiOkResponse({ type: HealthResponseDto })
  check(): Promise<HealthReport> {
    return this.checkHealth.execute();
  }
}
