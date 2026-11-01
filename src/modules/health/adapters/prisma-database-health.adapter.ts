import { Inject, Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../../shared/database/prisma.service.js';
import type { DatabaseHealthPort } from '../ports/database-health.port.js';

@Injectable()
export class PrismaDatabaseHealthAdapter implements DatabaseHealthPort {
  private readonly logger = new Logger(PrismaDatabaseHealthAdapter.name);

  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async ping(): Promise<boolean> {
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      return true;
    } catch (error) {
      this.logger.warn(`Banco indisponível: ${(error as Error).message}`);
      return false;
    }
  }
}
