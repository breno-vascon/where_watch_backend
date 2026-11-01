import { Inject, Injectable } from '@nestjs/common';
import {
  DATABASE_HEALTH,
  type DatabaseHealthPort,
} from '../ports/database-health.port.js';

export interface HealthReport {
  status: 'ok' | 'degraded';
  db: 'ok' | 'down';
  uptimeSeconds: number;
}

@Injectable()
export class CheckHealthUseCase {
  constructor(
    @Inject(DATABASE_HEALTH) private readonly database: DatabaseHealthPort,
  ) {}

  async execute(): Promise<HealthReport> {
    const dbOk = await this.database.ping();
    return {
      status: dbOk ? 'ok' : 'degraded',
      db: dbOk ? 'ok' : 'down',
      uptimeSeconds: Math.floor(process.uptime()),
    };
  }
}
