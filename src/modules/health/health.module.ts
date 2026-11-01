import { Module } from '@nestjs/common';
import { PrismaDatabaseHealthAdapter } from './adapters/prisma-database-health.adapter.js';
import { HealthController } from './controllers/health.controller.js';
import { DATABASE_HEALTH } from './ports/database-health.port.js';
import { CheckHealthUseCase } from './usecases/check-health.usecase.js';

@Module({
  controllers: [HealthController],
  providers: [
    CheckHealthUseCase,
    { provide: DATABASE_HEALTH, useClass: PrismaDatabaseHealthAdapter },
  ],
})
export class HealthModule {}
